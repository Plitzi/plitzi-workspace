import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openRun } from './run';
import { completeTask, nextTask, takeTask } from './tasks';
import { setTeamAgent } from './team';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** encore-2's test-1 approved the identity system and its components: a designer's work, not a tester's to review. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

describe("a tester's reviews", () => {
  it('are of code: a developer’s task in review is offered it, a designer’s never', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = plan.tasks
      .filter(task => task.id === 't-home' || task.id === 't-menu')
      .map(task => ({ ...task, dependsOn: [], ...(task.id === 't-home' ? { role: 'designer' } : {}) }));
    await openRun(lead(), await bench.writePlan(plan));

    const design = await takeTask(bench.agent('design-1'), 'es-launch', 't-home');
    await writeInCopy(design.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await completeTask(bench.agent('design-1', { token: design.token }), 'es-launch', 't-home');
    expect((await nextTask(bench.agent('test-1'), 'es-launch', 'tester')).leadReview).toBeUndefined();

    const menu = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await completeTask(bench.agent('dev-1', { token: menu.token }), 'es-launch', 't-menu');
    expect((await nextTask(bench.agent('test-1'), 'es-launch', 'tester')).leadReview?.task.id).toBe('t-menu');
  });
});
