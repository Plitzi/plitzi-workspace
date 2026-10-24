import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { openRun } from './run';
import { showTask } from './show';
import { completeTask } from './tasks';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * A line amended while its task waits in review is the one the finish holds it to: encore-2's t-playback-safety was
 * amended in review, approved on its old line, and the finish refused the run on it.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

const before = { said: 'The menu says Menú', check: "grep -q 'Menú' src/space/pages/menu.ts" };
const after = { said: 'The menu says Carta', check: "grep -q 'Carta' src/space/pages/menu.ts" };

describe('a line amended while its task is in review', () => {
  it('takes the old line’s place in what the task was accepted on', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, acceptance: [before] } : task));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    expect((await showTask(lead(), runId, 't-menu')).accepted).toEqual([{ ...before, ok: true }]);

    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, acceptance: [after] } : task));
    await amendRun(lead(), runId, await bench.writePlan(plan));

    expect((await showTask(lead(), runId, 't-menu')).accepted).toEqual([
      { ...after, ok: false, amended: expect.any(String) as unknown }
    ]);
  });
});
