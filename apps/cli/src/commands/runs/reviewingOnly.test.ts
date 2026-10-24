import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ownTask, reviewingOnly } from './shell';
import { openRun } from '../../runs/run';
import { completeTask, takeNext } from '../../runs/tasks';
import { setTeamAgent } from '../../runs/team';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

// encore-3: the designers said their progress through a review and were refused nine times, each fresh session anew.
describe('a sign of life said at a review', () => {
  it('is the review’s for an agent that holds no task, and never a writer’s', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const held = await take('dev-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

    expect(await reviewingOnly(bench.agent('design-1'), 'es-launch')).toBe('t-menu');
    const home = await take('dev-2', 't-home');
    expect(await reviewingOnly(home.ctx, 'es-launch')).toBeUndefined();
    expect(await reviewingOnly(lead(), 'es-launch')).toBeUndefined();
  });

  // encore-3: `task show` with no task was refused twice, its agent holding one.
  it('names the task an agent means when it names none: the one it holds, or the one it reviews', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const held = await take('dev-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    const home = await take('dev-2', 't-home');

    expect(await ownTask(bench.agent('design-1'), 'es-launch')).toBe('t-menu');
    expect(await ownTask(home.ctx, 'es-launch')).toBe('t-home');
  });
});
