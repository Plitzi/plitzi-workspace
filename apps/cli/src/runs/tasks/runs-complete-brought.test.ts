import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { completeTask, reviewTask } from '.';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { openRun } from '../run';

import type { Bench } from '../../tests/runProject';
import type { CheckRunner } from '../copies/checks';

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
    plan.tasks = plan.tasks.map(task => ({ ...task, dependsOn: [] }));
    await openRun(lead(), await bench.writePlan(plan));
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Carta" };\n');
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    // Failing in this task's copy alone: the run's work passes, so the failure is the copy's.
    const failing =
      (said: string): CheckRunner =>
      dir =>
        Promise.resolve(
          dir === home.work
            ? { ok: false, steps: [{ name: 'typecheck', ok: false, said: [said] }] }
            : { ok: true, steps: [] }
        );
    const refused = await refusal(
      completeTask(
        { ...home.ctx, checks: failing('src/space/pages/menu.ts(1,1): error TS2322') },
        'es-launch',
        't-home'
      )
    );

    expect(refused.code).toBe('checks-failed');
    expect(refused.message).toContain(
      'what fails names what came into the copy on this complete, approved in the run since the copy was made: src/space/pages/menu.ts'
    );
    // The step that fails, in the refusal's own words: a run's lead read the message alone, and guessed it an hour later.
    expect(refused.message).toContain('— typecheck (src/space/pages/menu.ts(1,1): error TS2322)');

    // What fails names nothing that came in: nothing is blamed — a run's lead blamed a person's edit of team.json for an
    // author failure of the task's own.
    const own = await refusal(
      completeTask({ ...home.ctx, checks: failing('hero.ts: a heading with no words') }, 'es-launch', 't-home')
    );
    expect(own.message).not.toContain('came into the copy');
  });
});
