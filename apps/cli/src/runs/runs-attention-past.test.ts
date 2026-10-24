import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadRun, openRun } from './run';
import { completeTask, reviewTask } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * encore-2 ended with ten notices standing in the lead's attention — lines that had failed and passed since, a task
 * refused before it was approved, Plitzi's own findings — and it read as if the lead had ignored them. What is past
 * leaves the lead's attention; what is Plitzi's is the feedback's.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

const failedCheck = (at: string) =>
  `${JSON.stringify({ at, by: 'agent-1', action: 'check', task: 't-home', ok: false, failed: ['acceptance — The hero says Hola'] })}\n`;

describe("the lead's attention", () => {
  it('says a line failing try after try while its task is worked, and not once the task is approved', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    await openRun(lead(), await bench.writePlan(plan));
    const home = await take('agent-1', 't-home');
    const { paths } = await loadRun(lead(), 'es-launch');
    for (const minute of ['10', '11', '12']) {
      await fs.appendFile(paths.log, failedCheck(`2030-01-01T00:${minute}:00.000Z`));
    }

    const findings = async () =>
      (await viewRun(lead(), 'es-launch')).attention.filter(item => item.kind === 'finding').map(item => item.task);
    expect(await findings()).toContain('t-home');

    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    expect(await findings()).not.toContain('t-home');
  });
});
