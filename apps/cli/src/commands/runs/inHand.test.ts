import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { either, heldNow, inHand, ownTask } from './shell';
import { openRun } from '../../runs/run';
import { completeTask, takeNext } from '../../runs/tasks';
import { setTeamAgent } from '../../runs/team';
import { benchPlan, designed, makeBench, writeInCopy } from '../../tests/runProject';
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

// The designers said their progress through a review and were refused nine times; a scout at the run's scope, at its
// spike (encore-11): what an agent has in hand is one reading, whatever kind it is.
describe('what an agent has in hand', () => {
  it('is its work, a review or a spike alike — the lead holds none', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(designed(benchPlan())));
    const held = await take('dev-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

    expect(await inHand(bench.agent('design-1'), 'es-launch')).toEqual({
      task: 't-menu',
      kind: 'review',
      agent: 'design-1'
    });
    const home = await take('dev-2', 't-home');
    expect(await inHand(home.ctx, 'es-launch')).toMatchObject({ task: 't-home', kind: 'work' });
    expect(await heldNow(lead(), 'es-launch')).toEqual([]);
    expect(await inHand(lead(), 'es-launch')).toBeUndefined();
  });

  // `task show` with no task was refused twice, its agent holding one.
  it('names the task an agent means when it names none: the one it holds, or the one it reviews', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(designed(benchPlan())));
    const held = await take('dev-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    const home = await take('dev-2', 't-home');

    expect(await ownTask(bench.agent('design-1'), 'es-launch')).toBe('t-menu');
    expect(await ownTask(home.ctx, 'es-launch')).toBe('t-home');
    // A reviewer's `task context` was refused four times; it reads the brief of what it reviews.
    expect(await either(bench.agent('design-1'), { run: 'es-launch' })).toEqual({
      runId: 'es-launch',
      taskId: 't-menu'
    });
  });
});
