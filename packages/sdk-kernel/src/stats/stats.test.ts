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

  it('says the last hour minute by minute, every minute, with the load sampled in each', () => {
    let now = 100 * MINUTE + 5000;
    const stats = createStatsRecorder({ pool: 'worker', instance: 'w-1' }, () => now);

    stats.run(10);
    stats.run(40, 'timeout');
    stats.refuse('over_capacity');
    stats.snapshot();
    now += 2 * MINUTE;
    stats.run(20);
    const { series } = stats.snapshot();
    const last = series.at(-1);
    const earlier = series.at(-3);

    expect(series).toHaveLength(60);
    expect(series[0]?.at).toBe(new Date(43 * MINUTE).toISOString());
    expect(last).toMatchObject({ at: new Date(102 * MINUTE).toISOString(), runs: 1, failed: 0, p95Ms: 20 });
    expect(earlier).toMatchObject({ runs: 2, failed: 1, refused: 1, p95Ms: 40 });
    expect(earlier?.rss).toBeGreaterThan(0);
    expect(series.at(-2)).toEqual({ at: new Date(101 * MINUTE).toISOString(), runs: 0, failed: 0, refused: 0 });
  });

  it('names what made a minute slow: its slowest runs and failures first, and the names that took the most', () => {
    const now = 200 * MINUTE + 1000;
    const stats = createStatsRecorder({ pool: 'worker', instance: 'w-1' }, () => now);
    const label = (name: string) => ({ spaceId: 34, kind: 'action', name, trigger: 'schedule' });

    stats.run(40, undefined, label('ping'));
    stats.run(9400, undefined, label('world-skies'));
    stats.run(30, 'timeout', label('checkout'));
    for (let run = 0; run < 6; run += 1) {
      stats.run(20 + run, undefined, label('ping'));
    }
    stats.run(5);
    const minute = stats.snapshot().series.at(-1);

    expect(minute?.runs).toBe(10);
    expect(minute?.runsOf?.map(run => [run.name, run.durationMs, run.failure])).toEqual([
      ['checkout', 30, 'timeout'],
      ['world-skies', 9400, undefined],
      ['ping', 40, undefined],
      ['ping', 25, undefined],
      ['ping', 24, undefined]
    ]);
    expect(minute?.names?.map(work => [work.name, work.runs, work.failed, work.maxMs])).toEqual([
      ['world-skies', 1, 0, 9400],
      ['ping', 7, 0, 40],
      ['checkout', 1, 1, 30]
    ]);
    expect(stats.snapshot().series.at(-2)?.runsOf).toBeUndefined();
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
    expect(pages?.counts).toMatchObject({ healthy: 1, degraded: 0, stopping: 0, down: 1 });
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

  it('reads an instance told to stop as stopping, answering or not', async () => {
    const source = createLocalPoolSource([
      { pool: 'worker', id: 'w-2', url: 'http://192.0.2.1:9', secret: '', orchestrator: { phase: 'stopping' } }
    ]);
    const health = await readPools(source, { timeoutMs: 200 });
    const pool = 'pools' in health ? health.pools[0] : undefined;

    expect(pool?.counts).toMatchObject({ healthy: 0, stopping: 1, down: 0 });
    expect(pool?.instances[0]?.reasons).toEqual(['stopping: finishing what it runs, taking nothing new']);
  });

  it('reads an instance its orchestrator says failed as failed, with why, without asking it', async () => {
    const source = createLocalPoolSource([
      {
        pool: 'runtime',
        id: 'pizarra · main',
        url: 'http://192.0.2.1:9',
        secret: '',
        orchestrator: { phase: 'failed', why: 'the build failed' }
      }
    ]);
    const startedAt = Date.now();
    const health = await readPools(source, { timeoutMs: 5000 });

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect('pools' in health && health.pools[0]?.instances[0]).toMatchObject({
      status: 'failed',
      reasons: ['the build failed']
    });
  });

  it('reads each phase its orchestrator says — starting, restarting, stopped — over what it answers', async () => {
    const source = createLocalPoolSource(
      (['starting', 'restarting', 'stopped'] as const).map(phase => ({
        pool: 'runner',
        id: `r-${phase}`,
        url: phase === 'stopped' ? 'http://192.0.2.1:9' : '',
        secret: '',
        orchestrator: { phase }
      }))
    );
    const health = await readPools(source, { timeoutMs: 200 });
    const instances = 'pools' in health ? (health.pools[0]?.instances ?? []) : [];

    expect(instances.map(each => [each.id, each.status])).toEqual([
      ['r-starting', 'starting'],
      ['r-restarting', 'restarting'],
      ['r-stopped', 'stopped']
    ]);
  });

  it('says so when nothing says which processes run', async () => {
    const health = await readPools(undefined);

    expect('unconfigured' in health && health.unconfigured).toMatch(/^No pool source is configured/);
  });
});
