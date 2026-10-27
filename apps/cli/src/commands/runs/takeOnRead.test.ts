import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { takeOnRead } from './takeOnRead';
import { openRun, readRunLog, loadRun } from '../../runs/run';
import { completeTask } from '../../runs/tasks';
import { viewRun } from '../../runs/view';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

/** Carlos: the monitor said the lead was "working", never at which task — it read them with `task show`. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

describe("a lead's read of a task in review", () => {
  it('takes its review, with no tester in the team: the board names the task it is at, said in the activity', async () => {
    const plan = benchPlan();
    await bench.writeTeam(teamFor(plan, 2));
    await openRun(lead(), await bench.writePlan(plan));
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');

    await takeOnRead(lead(), 'es-launch', 't-home');

    const line = (await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home');
    expect(line?.review?.by).toBe('lead');
    const log = await readRunLog((await loadRun(lead(), 'es-launch')).paths);
    expect(log.filter(entry => entry.action === 'review-taken')).toMatchObject([{ by: 'lead', task: 't-home' }]);

    // Read again, it is its already: nothing said twice.
    await takeOnRead(lead(), 'es-launch', 't-home');
    const again = await readRunLog((await loadRun(lead(), 'es-launch')).paths);
    expect(again.filter(entry => entry.action === 'review-taken')).toHaveLength(1);
  });

  // With testers, the lead reviews none: its read is a look — the review stays a tester's to take.
  it('takes nothing while the team has a tester', async () => {
    const plan = benchPlan();
    const team = teamFor(plan, 2);
    await bench.writeTeam({ ...team, agents: [...team.agents, { name: 'test', roles: ['tester'], session: 'keep' }] });
    await openRun(lead(), await bench.writePlan(plan));
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');

    await takeOnRead(lead(), 'es-launch', 't-home');

    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.review?.by).toBeUndefined();
  });
});
