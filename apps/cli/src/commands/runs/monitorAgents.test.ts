import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeLaunch } from '../../runs/launch';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { logRun } from '../../runs/run';
import { USAGE_FILE } from '../../runs/usage';
import { ranAs } from '../../tests/ranAs';
import { makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

// Carlos: a person reads an agent's status for what is happening — it is what it holds and whether anything is at it,
// never guessed from what it did lately.
describe('each agent’s status in the monitor', () => {
  // A run: "working" for three minutes after the lead opened the run, its scout at the scope.
  it('shows the lead by what it holds, as every agent — what it did lately said, never taken for work', async () => {
    const runId = await open();
    const paths = runPaths(bench.root, runId);
    await logRun(lead(), paths, { action: 'launch', agent: 'agent-1', harness: 'claude' });
    const row = async () => (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'lead');
    await fs.appendFile(
      path.join(paths.dir, USAGE_FILE),
      `${JSON.stringify({ at: bench.now().toISOString(), by: 'lead', command: 'plitzi task look t-home', ...ranAs('plitzi task look t-home'), chars: 10, ms: 10, code: 0 })}\n`
    );

    expect(await row()).toMatchObject({
      status: 'idle',
      doing: expect.stringMatching(/last: started agent-1 in claude — .*t-home/) as unknown
    });
  });

  // Carlos: every agent's status must be what is happening — a card read "working" while its agent's process had
  // ended, or while it was being started again with a fresh context.
  it('says a card’s agent stopped when its process ended, restarting when it is started again — never working', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    const paths = runPaths(bench.root, runId);
    const row = async () => (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'agent-1');
    expect((await row())?.status).toBe('working');

    await fs.mkdir(path.join(paths.scratch, 'agent-1'), { recursive: true });
    await writeLaunch(paths, 'agent-1', {
      pid: 999_999_999,
      harness: 'claude',
      startedAt: new Date(0).toISOString(),
      log: path.join(paths.scratch, 'agent-1', 'agent.log')
    });
    expect(await row()).toMatchObject({
      status: 'stopped',
      task: 't-home',
      doing: expect.stringContaining('holds t-home — its process ended') as unknown
    });

    await logRun(home.ctx, paths, { action: 'stops', why: 'a fresh context', fresh: true });
    expect(await row()).toMatchObject({
      status: 'restarting',
      doing: expect.stringContaining('then t-home') as unknown
    });
  });
});
