import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLocalPoolSource, readPools } from './pools';
import { createStatsRecorder, statsRecorderFor } from './recorder';
import { statsStage } from './stage';
import { makeHandler } from '../http/dispatcher';
import { createHttpServer } from '../http/server';
import { unusedPort } from '../http/unusedPort';

import type { BuildContext } from '../http/dispatcher';
import type { HttpServer } from '../http/server';
import type { BaseContext } from '../http/types';
import type { ServerBaseConfig } from '../types';

const SECRET = 'a-stats-secret-of-thirty-two-chars!!';
const MINUTE = 60_000;

describe('a process’s stats', () => {
  it('keeps its runs by minute, and reads them over the minute, the quarter and the hour', () => {
    let now = 100 * MINUTE;
    const stats = createStatsRecorder({ pool: 'worker', instance: 'w-1' }, () => now);

    stats.run(10);
    stats.run(30, 'timeout');
    now += 5 * MINUTE;
    stats.run(20);
    stats.refuse('over_capacity');
    const read = stats.snapshot();

    expect(read.outcomes['1m']).toMatchObject({ runs: 1, failures: {}, refusals: { over_capacity: 1 }, p50Ms: 20 });
    expect(read.outcomes['15m']).toMatchObject({ runs: 3, failures: { timeout: 1 }, p50Ms: 20, p95Ms: 30 });
    expect(read.outcomes['60m'].runs).toBe(3);
    now += 61 * MINUTE;
    expect(stats.snapshot().outcomes['60m'].runs).toBe(0);
  });

  it('says it is degraded, and why, when too many runs fail or its slots are full', () => {
    const stats = createStatsRecorder({ pool: 'worker', instance: 'w-1' });
    for (let run = 0; run < 10; run += 1) {
      stats.run(5, run < 3 ? 'error' : undefined);
    }
    stats.slot('calls', 10, () => 10);

    const { health, load } = stats.snapshot();

    expect(health.status).toBe('degraded');
    expect(health.reasons).toEqual(['3 of 10 runs failed in 15 minutes', 'calls: 10 of 10 in use']);
    expect(load.slots.calls).toEqual({ used: 10, of: 10 });
  });

  it('is healthy with too few runs to say anything of a rate', () => {
    const stats = createStatsRecorder({ pool: 'worker', instance: 'w-1' });
    stats.run(5, 'error');

    expect(stats.snapshot().health).toEqual({ status: 'healthy', reasons: [] });
  });

  it('refuses a secret too short to be one, at start', () => {
    expect(() =>
      createHttpServer(
        { httpVersion: 1, adapters: {}, stats: { secret: 'short', pool: 'pages' } },
        () => () => undefined,
        {
          label: 'TEST'
        }
      )
    ).toThrow('`stats.secret` must be at least 32 characters');
  });
});

describe('/_stats and the pools', () => {
  const config: ServerBaseConfig = {
    httpVersion: 1,
    adapters: {},
    stats: { secret: SECRET, pool: 'pages', instance: 'p-1' }
  };
  let server: HttpServer;
  let origin = '';

  beforeAll(async () => {
    const port = await unusedPort();
    const build = (forPort: number) => {
      const buildContext: BuildContext<BaseContext> = (raw, rawRes, req, res) => ({
        raw,
        rawRes,
        req,
        res,
        config,
        port: forPort
      });

      return makeHandler('TEST', buildContext, [statsStage]);
    };
    server = createHttpServer(config, build, { label: 'TEST' });
    await server.listen(port, '127.0.0.1');
    origin = `http://127.0.0.1:${String(port)}`;
    if (config.stats) {
      statsRecorderFor(config.stats).run(12);
    }
  });

  afterAll(async () => {
    await server.close();
  });

  it('answers its stats to its secret alone', async () => {
    const refused = await fetch(`${origin}/_stats`);
    const read = await fetch(`${origin}/_stats`, { headers: { authorization: `Bearer ${SECRET}` } });

    expect(refused.status).toBe(401);
    expect(await read.json()).toMatchObject({ pool: 'pages', instance: 'p-1', outcomes: { '1m': { runs: 1 } } });
  });

  it('reads every pool, and an instance that does not answer is down with why', async () => {
    const source = createLocalPoolSource([
      { pool: 'pages', id: 'p-1', url: origin, secret: SECRET },
      { pool: 'pages', id: 'p-2', url: origin, secret: 'not-the-secret-of-this-one-at-all!!' },
      { pool: 'worker', id: 'w-1', url: `http://127.0.0.1:${String(await unusedPort())}`, secret: SECRET }
    ]);

    const health = await readPools(source, { timeoutMs: 500 });

    if (!('pools' in health)) {
      throw new Error('a source was given');
    }

    const pages = health.pools.find(report => report.pool === 'pages');
    const worker = health.pools.find(report => report.pool === 'worker');
    expect(pages?.counts).toEqual({ healthy: 1, degraded: 0, down: 1 });
    expect(pages?.instances[0]?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(pages?.instances.map(instance => instance.reasons)).toEqual([
      [],
      ['answered 401 at /_stats: its secret is not this one']
    ]);
    expect(worker?.counts.down).toBe(1);
    expect(worker?.instances.map(instance => instance.reasons.join())).toEqual([
      expect.stringMatching(/^did not answer in 500 ms/)
    ]);
  });

  it('says so when nothing says which processes run', async () => {
    const health = await readPools(undefined);

    expect('unconfigured' in health && health.unconfigured).toMatch(/^No pool source is configured/);
  });
});
