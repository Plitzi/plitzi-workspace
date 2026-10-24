import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openRun } from './run';
import { completeTask, reviewTask } from './tasks';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * A task that changes a page an approved task was accepted on runs that task's lines again before review: encore's
 * stats panel and the retro's `/design` copy broke three lines of earlier stages, and nothing said so until the finish.
 */

// Which page a file draws is read off an authored space, and the run's bench authors none: the menu's file draws /menu.
vi.mock('./pagesOf', async importOriginal => ({
  ...(await importOriginal<typeof import('./pagesOf')>()),
  pagesOf: (_root: string, files: readonly string[]) =>
    Promise.resolve(files.includes('src/space/pages/menu.ts') ? ['/menu'] : [])
}));

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, take } = runSteps(() => bench);

/** A line that checks the menu page, as a page command names it, and holds while the menu reads in Spanish. */
const menuLine = {
  said: 'The menu reads in Spanish',
  check: "grep -q 'Menú' src/space/pages/menu.ts # plitzi page check /menu"
};

const opened = async () => {
  const plan = benchPlan();
  plan.designReview = false;
  plan.tasks = plan.tasks.map(task =>
    task.id === 't-menu'
      ? { ...task, acceptance: [menuLine] }
      : task.id === 't-about'
        ? { ...task, touches: ['src/space/pages/menu.ts'], dependsOn: ['t-menu'], acceptance: ['The prices follow'] }
        : task
  );
  const file = await bench.writePlan(plan);
  await bench.writeTeam(teamFor(plan, 2));
  const { runId } = (await openRun(lead(), file)).checked;
  const menu = await take('agent-1', 't-menu');
  await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
  await completeTask(menu.ctx, runId, 't-menu');
  await reviewTask(lead(), runId, 't-menu', 'approve', []);

  return runId;
};

describe('the lines of approved tasks, on a page a task changes', () => {
  it('refuses a task that breaks one, naming whose — and takes it when the change is said to be meant', async () => {
    const runId = await opened();

    const prices = await take('agent-2', 't-about');
    await writeInCopy(prices.work, 'src/space/pages/menu.ts', 'export const page = { title: "Carta" };\n');
    const refused = await refusal(completeTask(prices.ctx, runId, 't-about'));

    expect(refused.code).toBe('checks-failed');
    expect(refused.message).toContain('t-menu: "The menu reads in Spanish"');
    expect(refused.message).toContain('breaks what approved tasks were accepted on');

    await completeTask(prices.ctx, runId, 't-about', {
      knownFailure: { why: 'The page is the Carta now: the lead amends its line', fixedBy: 'lead' }
    });
  });
});
