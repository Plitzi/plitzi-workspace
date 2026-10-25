import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openRun } from './run';
import { completeTask, reviewTask } from './tasks';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { CheckRunner } from './checks';
import type { Bench } from '../tests/runProject';

/**
 * A run's test-1 checked green, completed, and failed on a file the run had approved since — taken into its copy by
 * the complete — with no word of which had come in.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take, refusal } = runSteps(() => bench);

describe('a complete whose checks fail', () => {
  it('says first what its copy took from the run on that complete', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = plan.tasks.map(task => ({ ...task, dependsOn: [] }));
    await openRun(lead(), await bench.writePlan(plan));
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Carta" };\n');
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    // Failing in this task's copy alone: the run's work passes, so the failure is the copy's.
    const failing: CheckRunner = dir =>
      Promise.resolve(
        dir === home.work
          ? { ok: false, steps: [{ name: 'typecheck', ok: false, said: ['an import of menu.ts'] }] }
          : { ok: true, steps: [] }
      );
    const refused = await refusal(completeTask({ ...home.ctx, checks: failing }, 'es-launch', 't-home'));

    expect(refused.code).toBe('checks-failed');
    expect(refused.message).toContain('it took from the run, on this complete, what was approved since');
    expect(refused.message).toContain('src/space/pages/menu.ts');
  });
});
