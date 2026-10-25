import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { launchAgent, launchHarness } from './launchAgent';
import { openRun } from './run';
import { setTeamAgent } from './team';
import { benchPlan, makeBench } from '../tests/runProject';

import type { Bench } from '../tests/runProject';

/**
 * The run's keeper and the lead's watch both found design-1 not running and both started it — two sessions on
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
  // A lead asked again to start one that ran was refused — what it asked was so already.
  it('starts it once when two start it at once: the other is told it runs, as an answer', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await openRun(bench.agent('lead'), await bench.writePlan(benchPlan()));

    const both = await Promise.all([
      launchAgent(bench.agent('lead'), 'es-launch', 'dev-1', 'claude'),
      launchAgent(bench.agent('lead'), 'es-launch', 'dev-1', 'claude')
    ]);

    expect(both.filter(each => 'launched' in each)).toHaveLength(1);
    expect(both.find(each => 'running' in each)).toMatchObject({ agent: 'dev-1', running: { harness: 'claude' } });
  });
});

// A run's lead was refused "Which harness: --harness claude | opencode" for one its team.json named.
describe('the harness an agent starts in', () => {
  it('is the one named, else the team’s own launch, else none — the machine’s one alone, or asked', () => {
    expect(launchHarness('opencode', { options: { launch: 'claude' } })).toBe('opencode');
    expect(launchHarness(undefined, { options: { launch: 'claude' } })).toBe('claude');
    expect(launchHarness(undefined, { options: {} })).toBeUndefined();
    expect(launchHarness(undefined, undefined)).toBeUndefined();
  });
});
