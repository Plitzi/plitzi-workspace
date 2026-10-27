import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openRun } from './run';
import { completeTask, reviewTask } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * A task that changes a page an approved task was accepted on runs that task's lines again before review: a run's
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

const opened = async (
  line: typeof menuLine = menuLine,
  about: (typeof menuLine | string)[] = ['The prices follow']
) => {
  const plan = benchPlan();
  plan.tasks = plan.tasks.map(task =>
    task.id === 't-menu'
      ? { ...task, acceptance: [line] }
      : task.id === 't-about'
        ? { ...task, touches: ['src/space/pages/menu.ts'], dependsOn: ['t-menu'], acceptance: about }
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

  // Its own lines passed on the copy served for them, which was stopped before the approved
  // tasks' lines ran on it — "nothing answers", refused three times as breaking five lines it had not touched.
  it('runs the approved lines on the copy served for its own, still answering', async () => {
    await bench.write(
      'serve.mjs',
      "import http from 'node:http';\n\nhttp.createServer((q, r) => r.end('served')).listen(process.env.PORT);\n"
    );
    await bench.write(
      'package.json',
      `${JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { start: 'node serve.mjs' } })}\n`
    );
    await bench.write(
      'check.mjs',
      "const text = await (await fetch(process.env.PLITZI_URL)).text();\nprocess.exit(text === 'served' ? 0 : 1);\n"
    );
    const served = { said: 'The menu answers', check: 'node check.mjs $PLITZI_URL # plitzi page check /menu' };
    const runId = await opened(served, [{ said: 'The about answers', check: 'node check.mjs $PLITZI_URL' }]);

    const prices = await take('agent-2', 't-about');
    await writeInCopy(prices.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú", prices: true };\n');
    expect(await completeTask(prices.ctx, runId, 't-about')).toMatchObject({ changed: ['src/space/pages/menu.ts'] });
  }, 60_000);

  it('tells the lead of an approved line nothing could answer on the copy, and does not hold it against the task', async () => {
    const unread = {
      said: 'The menu reads in Spanish',
      check: "grep -q 'Menú' src/space/pages/menu.ts || exit 2 # plitzi page check /menu"
    };
    const runId = await opened(unread);

    const prices = await take('agent-2', 't-about');
    await writeInCopy(prices.work, 'src/space/pages/menu.ts', 'export const page = { title: "Carta" };\n');
    await completeTask(prices.ctx, runId, 't-about');

    const told = (await viewRun(lead(), runId)).attention.filter(item => item.kind === 'line-unanswered');
    expect(told).toContainEqual(
      expect.objectContaining({
        task: 't-menu',
        text: expect.stringContaining('"The menu reads in Spanish" cannot be answered') as unknown
      })
    );
  });
});
