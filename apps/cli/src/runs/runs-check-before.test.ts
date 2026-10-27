import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { changesNoPage } from './pagesOf';
import { checkBefore, completeTask, provedBy, reviewTask } from './tasks';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take } = runSteps(() => bench);

// encore-13's tester, reviewing a test's fix, copied the spec without the new line into its scratch with a playwright
// config of its own, to see the acceptance fail without the change.
describe('a task’s acceptance set beside the run before it', () => {
  it('says which line proves the change — fails before it, passes with it — and which proves nothing', async () => {
    const plan = benchPlan();
    plan.tasks[3].acceptance = [
      { said: 'About is Spanish', check: 'grep -q Acerca src/space/pages/about.ts' },
      { said: 'About is there', check: 'test -f src/space/pages/about.ts' },
      { said: 'About says goodbye', check: 'grep -q Adios src/space/pages/about.ts' }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await completeTask(about.ctx, runId, 't-about', { knownFailure: { why: 'the goodbye is the next task’s' } });

    const { lines } = await checkBefore(bench.agent('test-1'), runId, 't-about');

    expect(lines.map(line => [line.said, provedBy(line)])).toEqual([
      ['About is Spanish', 'proves'],
      ['About is there', 'proves-nothing'],
      ['About says goodbye', 'fails']
    ]);
  });

  // encore-14's tester was pointed at --before for a task of tests, and every line passed on both: what it tests was
  // approved already, in the run before it.
  it('sets a task of tests beside the run without the task it tests, where its lines fail', async () => {
    const plan = benchPlan();
    plan.tasks.push({
      id: 't-about-tests',
      title: 'Tests for t-about',
      files: ['src/space/pages/about.test.ts'],
      dependsOn: ['t-about'],
      priority: 'low',
      estimateMinutes: 10,
      testsOf: ['t-about'],
      acceptance: [{ said: 'About is Spanish, held', check: 'grep -q Acerca src/space/pages/about.ts' }]
    });
    plan.tasks[3].acceptance = [{ said: 'About is Spanish', check: 'grep -q Acerca src/space/pages/about.ts' }];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await completeTask(about.ctx, runId, 't-about');
    await reviewTask(lead(), runId, 't-about', 'approve', []);
    const tests = await take('agent-2', 't-about-tests');
    await writeInCopy(tests.work, 'src/space/pages/about.test.ts', '// held\n');

    const checked = await checkBefore(bench.agent('test-1'), runId, 't-about-tests');

    expect(checked.without).toEqual(['t-about']);
    expect(checked.lines.map(line => provedBy(line))).toEqual(['proves']);
  });

  it('is refused for a task with no line a command checks, and one with no copy', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    expect((await refusal(checkBefore(about.ctx, runId, 't-about'))).message).toContain(
      'has no acceptance line a command checks'
    );
    expect((await refusal(checkBefore(lead(), runId, 't-book'))).message).toContain('is pending');
  });
});

// encore-13: a look of a task that changed only a spec pictured the home page — 19 pictures it could not touch.
describe('a task that changes no page', () => {
  it('is one whose files the project draws nothing from, and whose acceptance checks no page', async () => {
    const checked = [{ said: 'The spec passes', check: 'npx playwright test visual/home.spec.ts' }];

    expect(await changesNoPage(bench.root, ['visual/home.spec.ts', 'playwright.config.ts'], checked)).toBe(true);
    expect(await changesNoPage(bench.root, ['visual/home.spec.ts', 'src/space/pages/about.ts'], checked)).toBe(false);
    // Under the source, though no page imports it — data, server code: not said to change no page.
    expect(await changesNoPage(bench.root, ['src/data/menu.json'], checked)).toBe(false);
    expect(await changesNoPage(bench.root, ['public/hero.css'], checked)).toBe(false);
    expect(
      await changesNoPage(bench.root, ['visual/home.spec.ts'], [{ said: 'Home', check: 'plitzi page check /' }])
    ).toBe(false);
    expect(await changesNoPage(bench.root, [], checked)).toBe(false);
  });
});
