import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { caughtBy, checkBefore, checkMutant, completeTask, failedNames, failureText, provedBy, reviewTask } from '.';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { changesNoPage } from '../plan/pagesOf';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take } = runSteps(() => bench);

// A run's tester, reviewing a test's fix, copied the spec without the new line into its scratch with a playwright
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

  // A run's tester was pointed at --before for a task of tests, and every line passed on both: what it tests was
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

  // A tester read "passes before too: proves nothing" of a task whose tests it changed: the run's old test file passed
  // the old code. And a spec a task adds read "fails before: proves it", the spec only missing there.
  it('runs the task’s own tests on the code before it — and says a line that ran no test there proves nothing', async () => {
    const plan = benchPlan();
    plan.tasks[3].files = [...plan.tasks[3].files, 'src/space/pages/about.test.ts'];
    plan.tasks[3].acceptance = [
      { said: 'Its test holds', check: 'grep -q "$(cat src/space/pages/about.test.ts)" src/space/pages/about.ts' },
      {
        said: 'Its spec runs',
        check: 'grep -q Acerca src/space/pages/about.ts || { echo "No tests found"; exit 1; }'
      }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await writeInCopy(about.work, 'src/space/pages/about.test.ts', 'Acerca');
    await completeTask(about.ctx, runId, 't-about');

    const { lines } = await checkBefore(bench.agent('test-1'), runId, 't-about');

    expect(lines.map(line => [line.said, provedBy(line)])).toEqual([
      ['Its test holds', 'proves'],
      ['Its spec runs', 'unanswered']
    ]);
  });

  // A tester read "passes before too" of a task that moved every spec onto a fixture: its own tests, put on the run
  // before it, were its change — the line reading the specs passed there.
  it('sets a task whose change is its tests beside the run without them, where a line reading them fails', async () => {
    await bench.write('src/space/pages/about.spec.ts', "import { test } from '@playwright/test';\n");
    const plan = benchPlan();
    plan.tasks[3].files = ['src/space/pages/about.spec.ts'];
    plan.tasks[3].acceptance = [
      { said: 'The spec takes the fixture', check: 'grep -q "./offline" src/space/pages/about.spec.ts' },
      { said: 'The spec is there', check: 'test -f src/space/pages/about.spec.ts' }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.spec.ts', "import { test } from './offline';\n");
    await completeTask(about.ctx, runId, 't-about');

    const { lines } = await checkBefore(bench.agent('test-1'), runId, 't-about');

    expect(lines.map(line => [line.said, provedBy(line)])).toEqual([
      ['The spec takes the fixture', 'proves'],
      ['The spec is there', 'proves-nothing']
    ]);
  });

  // A tester read "the charts' tests pass as they were" as proving the change: it failed before only on the test the
  // task added to that file.
  it('says a line that proves the change only through the tests the task adds', async () => {
    await bench.write('src/space/pages/about.ts', "export const about = { title: 'Hola' };\n");
    await bench.write('src/space/pages/about.test.ts', 'Hola');
    const plan = benchPlan();
    plan.tasks[3].files = ['src/space/pages/about.ts', 'src/space/pages/about.test.ts'];
    plan.tasks[3].acceptance = [
      {
        said: 'Its tests pass as they were',
        check: 'grep -q "$(cat src/space/pages/about.test.ts)" src/space/pages/about.ts'
      },
      { said: 'About is Spanish', check: 'grep -q Acerca src/space/pages/about.ts' }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await writeInCopy(about.work, 'src/space/pages/about.test.ts', 'Acerca');
    await completeTask(about.ctx, runId, 't-about');

    const { lines } = await checkBefore(bench.agent('test-1'), runId, 't-about');

    expect(lines.map(line => [line.said, provedBy(line), line.byOwnTests ?? false])).toEqual([
      ['Its tests pass as they were', 'proves', true],
      ['About is Spanish', 'proves', false]
    ]);
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

// A run's tester, reviewing tasks of tests, copied the task's src/ into its scratch, changed the code under test with
// sed and ran node --test there by hand, to see whether a test held what it was meant to.
describe('a task’s acceptance run on a mutant of its copy', () => {
  it('says which line catches the change made to the code, and which lets it pass', async () => {
    const plan = benchPlan();
    plan.tasks[3].acceptance = [
      { said: 'The title is Spanish', check: 'grep -q "title: \'Acerca\'" src/space/pages/about.ts' },
      { said: 'About is there', check: 'test -f src/space/pages/about.ts' },
      { said: 'About says goodbye', check: 'grep -q Adios src/space/pages/about.ts' }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await completeTask(about.ctx, runId, 't-about', { knownFailure: { why: 'the goodbye is the next task’s' } });

    const checked = await checkMutant(bench.agent('test-1'), runId, 't-about', [
      { file: 'src/space/pages/about.ts', from: "'Acerca'", to: "'About'" }
    ]);

    expect(checked.lines.map(line => [line.said, caughtBy(line)])).toEqual([
      ['The title is Spanish', 'catches'],
      ['About is there', 'misses'],
      ['About says goodbye', 'fails']
    ]);
    // The copy itself is left as it was.
    expect(
      (
        await refusal(
          checkMutant(bench.agent('test-1'), runId, 't-about', [
            { file: 'src/space/pages/about.ts', from: "'About'", to: 'x' }
          ])
        )
      ).message
    ).toContain('has no "\'About\'"');
  });

  // A tester's mutant of one of two places that held a behaviour read "nothing holds it": both changed, it fails.
  it('takes several changes at once — a behaviour the code holds in two places', async () => {
    const plan = benchPlan();
    plan.tasks[3].acceptance = [{ said: 'Either says Acerca', check: 'grep -q Acerca src/space/pages/about.ts' }];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(
      about.work,
      'src/space/pages/about.ts',
      "export const a = 'Acerca';\nexport const b = 'Acerca!';\n"
    );
    await completeTask(about.ctx, runId, 't-about');
    const one = { file: 'src/space/pages/about.ts', from: "a = 'Acerca'", to: "a = 'About'" };
    const both = [one, { file: 'src/space/pages/about.ts', from: "b = 'Acerca!'", to: "b = 'About!'" }];

    expect((await checkMutant(bench.agent('test-1'), runId, 't-about', [one])).lines.map(caughtBy)).toEqual(['misses']);
    expect((await checkMutant(bench.agent('test-1'), runId, 't-about', both)).lines.map(caughtBy)).toEqual(['catches']);
  });

  // A tester's mutant named no defined name, and read "fails on the mutant: it holds it"; another could not tell which
  // test failed; and proving a unit test cost a Playwright run per mutant.
  it('says a mutant that does not run, names the test that failed, and runs only the lines asked', async () => {
    const plan = benchPlan();
    plan.tasks[3].acceptance = [
      {
        said: 'The title is Spanish',
        check:
          'grep -q Acerca src/space/pages/about.ts || { echo "✖ the title is Spanish"; echo "AssertionError: expected Acerca"; exit 1; }'
      },
      {
        said: 'It runs',
        check: 'grep -q Acerca src/space/pages/about.ts || { echo "ReferenceError: WEEKX is not defined"; exit 1; }'
      }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await completeTask(about.ctx, runId, 't-about');
    const mutation = { file: 'src/space/pages/about.ts', from: "'Acerca'", to: "'About'" };

    const checked = await checkMutant(bench.agent('test-1'), runId, 't-about', [mutation]);
    expect(checked.lines.map(caughtBy)).toEqual(['catches', 'broken']);
    expect(failedNames(checked.lines[0]?.mutant.output ?? [])).toEqual(['the title is Spanish']);

    const second = await checkMutant(bench.agent('test-1'), runId, 't-about', [mutation], [2]);
    expect(second.lines.map(line => line.said)).toEqual(['It runs']);
    expect((await refusal(checkMutant(bench.agent('test-1'), runId, 't-about', [mutation], [3]))).message).toContain(
      "t-about's acceptance has 2 lines: plitzi task prove t-about --line 3 names none"
    );
  });

  // A tester read the error context a failure on the mutant named, and it was gone with the mutant's folder.
  it('keeps the files a failing line names, and names them where they are kept', async () => {
    const plan = benchPlan();
    plan.tasks[3].acceptance = [
      {
        said: 'The title is Spanish',
        check:
          'grep -q Acerca src/space/pages/about.ts || { mkdir -p tmp/visual/about; grep title src/space/pages/about.ts > tmp/visual/about/error-context.md; echo "Error Context: tmp/visual/about/error-context.md"; exit 1; }'
      }
    ];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const about = { title: 'Acerca' };\n");
    await completeTask(about.ctx, runId, 't-about');

    const checked = await checkMutant(bench.agent('test-1'), runId, 't-about', [
      { file: 'src/space/pages/about.ts', from: "'Acerca'", to: "'About'" }
    ]);
    const named = (checked.lines[0]?.mutant.output ?? []).join('\n').match(/Error Context: (\S+)/)?.[1] ?? '';

    expect(path.isAbsolute(named)).toBe(true);
    expect(await fs.readFile(named, 'utf-8')).toContain("title: 'About'");
  });

  // A tester read two of three failed tests from a cut of Playwright's tail, never how many.
  it('says how many tests a failure names, each once, then its last lines', () => {
    const output = [
      '  ✘  1 [rest] › visual/charts.spec.ts:55:5 › at 1440px › a week with claps (817ms)',
      '  ✘  4 [rest] › visual/charts.spec.ts:139:5 › at 1440px › a week no one clapped in (411ms)',
      '  ✘  5 [rest] › visual/charts.spec.ts:55:5 › at 390px › a week with claps (747ms)',
      '  1) [rest] › visual/charts.spec.ts:55:5 › at 1440px › a week with claps',
      '    Error: expect(received).toEqual(expected)',
      '  3 failed',
      '  1 passed (4.1s)'
    ];

    expect(failureText(output, 2)).toBe(
      [
        '3 failed — [rest] › visual/charts.spec.ts:55:5 › at 1440px › a week with claps · [rest] › visual/charts.spec.ts:139:5 › at 1440px › a week no one clapped in · [rest] › visual/charts.spec.ts:55:5 › at 390px › a week with claps',
        '  3 failed',
        '  1 passed (4.1s)'
      ].join(' ⏎ ')
    );
  });

  it('is refused for a change that names no one place, and a file the copy has not', async () => {
    const plan = benchPlan();
    plan.tasks[3].acceptance = [{ said: 'About is there', check: 'test -f src/space/pages/about.ts' }];
    const runId = await open(plan);
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const a = 'x';\nexport const b = 'x';\n");
    const mutant = (file: string, from: string) => checkMutant(about.ctx, runId, 't-about', [{ file, from, to: 'y' }]);

    expect((await refusal(mutant('src/space/pages/about.ts', "'x'"))).message).toContain(
      "2 times — line 1: export const a = 'x'; · line 2: export const b = 'x'; — quote more of the one you mean"
    );
    // Written with the file's own spaces: what it writes, said to quote.
    expect((await refusal(mutant('src/space/pages/about.ts', "a='x'"))).message).toContain(
      'it writes it "a = \'x\'": quote that'
    );
    expect((await refusal(mutant('../outside.ts', 'x'))).message).toContain('is no file of t-about');
    expect((await refusal(mutant('src/space/pages/none.ts', 'x'))).message).toContain('is no file of t-about');
  });
});

// A look of a task that changed only a spec pictured the home page — 19 pictures it could not touch.
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

// Two mutants whose server never started — a module that did not load, a space refused — read "1 of 1 line catches it".
describe('a mutant that never runs', () => {
  it('is broken, not caught: its server never answered, its module did not load', () => {
    const line = (output: string[]) => ({
      said: 'The auth spec passes on the copy served',
      check: 'npx playwright test visual/auth.spec.ts',
      copy: { said: '', check: '', ok: true },
      mutant: { said: '', check: '', ok: false, output }
    });

    expect(caughtBy(line(['Error: Timed out waiting 120000ms from config.webServer.']))).toBe('broken');
    expect(caughtBy(line(['ProjectModuleError: src/space/shell/account.ts could not be imported']))).toBe('broken');
    expect(caughtBy(line(["the copy's server stopped on an error before it answered on http://127.0.0.1:4100"]))).toBe(
      'broken'
    );
    expect(caughtBy(line(['  ✘ 1 [rest] › visual/auth.spec.ts:90:3 › on /sign-in the key is latched (5.1s)']))).toBe(
      'catches'
    );
  });
});
