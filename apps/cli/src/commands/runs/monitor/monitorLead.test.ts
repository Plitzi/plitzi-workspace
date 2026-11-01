import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { waitForLead } from '../../../runs/agents/leadWatch';
import { setTeamAgent } from '../../../runs/agents/team';
import { runPaths } from '../../../runs/core/paths';
import { viewTask } from '../../../runs/core/taskStore';
import { loadRun } from '../../../runs/run';
import { completeTask, findTask } from '../../../runs/tasks';
import { takeOnLook } from '../../../runs/tasks/reviews';
import { monitorRun } from '../../../runs/view/monitor';
import { benchPlan, makeBench, writeInCopy } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

import type { Bench } from '../../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

const leadRow = async (runId: string) => (await monitorRun(lead(), runId)).agents.find(agent => agent.kind === 'lead');

// The lead works for the person too, away from the run for a while: its row said "idle" over a lead nobody could reach.
describe('the lead on the monitor', () => {
  it('watches the run while its watch waits, decides between, and is away past a while of neither', async () => {
    const runId = await open(benchPlan());
    expect(await leadRow(runId)).toMatchObject({ status: 'idle' });

    // Its watch marks it watching while it waits, and lets go as it ends.
    const watching = runPaths(bench.root, runId).leadWatching;
    await fs.writeFile(watching, JSON.stringify({ pid: process.pid, at: bench.now().toISOString() }));
    // Watching, not waiting: a lead at something else with its watch open read "waiting" — its last act said beside.
    expect(await leadRow(runId)).toMatchObject({
      status: 'watching',
      doing: expect.stringMatching(
        /^watches the run since \d\d:\d\d UTC — woken the moment something needs it · its last act (just now|\d+ min ago)/
      ) as unknown
    });
    await fs.rm(watching);
    await waitForLead(lead(), runId, { timeoutMs: 20, everyMs: 10, launch: false });
    await expect(fs.access(watching)).rejects.toThrow();

    bench.advance(3 * 60_000);
    expect(await leadRow(runId)).toMatchObject({
      status: 'away',
      doing: expect.stringContaining('away from the run since') as unknown
    });
    // A watch whose process is gone watches nothing.
    await fs.writeFile(watching, JSON.stringify({ pid: 999_999, at: bench.now().toISOString() }));
    expect(await leadRow(runId)).toMatchObject({ status: 'away' });
  });

  // A card the lead reviews holds it as a writer's task holds its writer: the monitor listed it again, as an agent of
  // no team entry — two "lead" rows, the second one's model the harness's.
  it('is one row while it reviews a card, the review said on it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const runId = await open(benchPlan());
    const menu = await take('dev-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    const loaded = await loadRun(lead(), runId);
    expect(await takeOnLook(lead(), loaded, await viewTask(loaded.paths, findTask(loaded, 't-menu')))).toBe(true);

    const { agents } = await monitorRun(lead(), runId);
    expect(agents.filter(agent => agent.agent === 'lead')).toEqual([
      expect.objectContaining({ kind: 'lead', status: 'reviewing', task: 't-menu' })
    ]);
  });
});
