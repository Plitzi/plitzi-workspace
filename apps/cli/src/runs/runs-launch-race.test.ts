import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { launchAgent } from './launchAgent';
import { openRun } from './run';
import { setTeamAgent } from './team';
import { benchPlan, makeBench } from '../tests/runProject';

import type { Bench } from '../tests/runProject';

/**
 * encore-3: the run's keeper and the lead's watch both found design-1 not running and both started it — two sessions on
 * one copy — and test-1 three times: the check that an agent runs and its start were two steps.
 */

let bench: Bench;
let bin = '';
const path0 = process.env.PATH;

beforeEach(async () => {
  bench = await makeBench();
  // A harness that only waits: started for real, as `claude` is, with nothing of a model in it.
  bin = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-fake-claude-'));
  await fs.writeFile(path.join(bin, 'claude'), '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
  process.env.PATH = `${bin}${path.delimiter}${path0 ?? ''}`;
});

afterEach(async () => {
  process.env.PATH = path0;
  for (const agent of ['dev-1']) {
    const record = await fs
      .readFile(path.join(bench.root, 'tmp', 'plitzi-runs', 'es-launch', 'scratch', agent, 'agent.json'), 'utf-8')
      .then(text => JSON.parse(text) as { pid: number })
      .catch(() => undefined);
    if (record) {
      process.kill(record.pid);
    }
  }

  await fs.rm(bin, { recursive: true, force: true });
  await bench.cleanup();
});

describe('starting an agent', () => {
  it('starts it once when two start it at once: the other is told it runs', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await openRun(bench.agent('lead'), await bench.writePlan(benchPlan()));

    const both = await Promise.allSettled([
      launchAgent(bench.agent('lead'), 'es-launch', 'dev-1', 'claude'),
      launchAgent(bench.agent('lead'), 'es-launch', 'dev-1', 'claude')
    ]);

    expect(both.map(each => each.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(both.find(each => each.status === 'rejected')).toMatchObject({
      reason: { code: 'invalid', detail: { running: true } }
    });
  });
});
