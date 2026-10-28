import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { leadItems } from './leadWatch';
import { readTeam, setTeamAgent, TEAM_FILE } from './team';
import { benchPlan, designed, makeBench, writeInCopy } from '../../tests/runProject';
import { teamSteps } from '../../tests/teamSteps';
import { taskPaths } from '../core/paths';
import { readState } from '../core/taskStore';
import { testFilesFor } from '../plan/tests';
import { buildReport } from '../report/report';
import { checkPlanFile, loadRun, openRun, readRunLog } from '../run';
import { messagesOf } from '../talk/messages';
import { completeTask, nextTask, reassignTask, reviewTask, takeNext, takeTask, taskContext } from '../tasks';
import { FIRST_REVIEW_READING_MS, REVIEW_TIMEOUT_MS } from '../tasks/reviews';
import { monitorRun } from '../view/monitor';
import { viewRun } from '../view/view';

import type { Bench } from '../../tests/runProject';

/** A run worked by the project's team (`.plitzi/team.json`): its size, its tester's tasks, its designer's reviews. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, completed, reviewOf, refusalOf } = teamSteps(() => bench);

describe('the tests of a developer task, with a tester in the team', () => {
  it('are where the project keeps them: a page’s spec, a module’s test beside it', () => {
    // A module under the pages is tested with the page that owns it; one the pages share, with theirs.
    const owners = new Map([['src/space/pages/walkFilter.ts', 'src/space/pages/walks.ts']]);
    expect(
      testFilesFor(['src/space/pages/walkFilter.ts', 'src/space/pages/dogFilter.ts', 'src/space/lib/age.ts'], {
        unitOf: file => owners.get(file) ?? (file.endsWith('dogFilter.ts') ? undefined : file)
      })
    ).toEqual(['visual/walks.spec.ts', 'src/space/lib/age.test.ts']);
    expect(
      testFilesFor([
        'src/space/pages/home/index.ts',
        'src/space/pages/home/hero.ts',
        'src/space/pages/menu.ts',
        'src/functions/book.ts',
        'src/plugins/map/Map.tsx',
        'src/space/theme.ts',
        'src/main.ts',
        'src/data/menu.json'
      ])
    ).toEqual(['visual/home.spec.ts', 'visual/menu.spec.ts', 'src/functions/book.test.ts']);
  });

  it('are a task after each one, a developer’s — none for one that says tests: false — and the team is the run’s size', async () => {
    await bench.write(
      'package.json',
      JSON.stringify({
        name: 'bench',
        type: 'module',
        private: true,
        scripts: { start: 'node src/main.ts' },
        devDependencies: { '@playwright/test': '^1.56.1' }
      })
    );
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    const about = plan.tasks.find(task => task.id === 't-about');
    if (about) {
      about.tests = false;
    }

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    const tests = checked.tasks.filter(task => task.testsOf !== undefined);
    expect(tests.map(task => [task.id, task.role, task.testsOf, task.dependsOn, task.files])).toEqual([
      ['t-home-tests', 'developer', ['t-home'], ['t-home'], ['visual/home.spec.ts']],
      ['t-menu-tests', 'developer', ['t-menu'], ['t-menu'], ['visual/menu.spec.ts']],
      ['t-book-tests', 'developer', ['t-book'], ['t-book'], ['visual/book.spec.ts']]
    ]);
    expect(tests[0]?.acceptance.at(-1)).toEqual({
      said: 'Its pages’ tests pass against the copy served',
      check: 'npx playwright test visual/home.spec.ts --reporter=line'
    });
    expect(checked.notices).toContainEqual(expect.stringContaining("each a developer's that did not write it"));
    // Two developers work its developer tasks at once: the tester takes none of them.
    expect(checked.estimate.agents).toBe(2);
  });

  // Every derived test was `visual/`, `npx` and `node --test`: a project with its specs elsewhere, on vitest and pnpm,
  // was handed specs its suite never read and checks it does not run.
  it('are where the project keeps its tests, run by its own runner, through its package manager', async () => {
    await bench.write(
      'package.json',
      JSON.stringify({
        name: 'bench',
        type: 'module',
        private: true,
        scripts: { start: 'node src/main.ts' },
        devDependencies: { '@playwright/test': '^1.56.1', vitest: '^3.2.4' }
      })
    );
    await bench.write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
    await bench.write('playwright.config.ts', "export default defineConfig({ testDir: './e2e/', use: {} });\n");
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-home');
    plan.tasks[0].files.push('src/functions/book.ts');

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    const tests = checked.tasks.find(task => task.id === 't-home-tests');
    expect(tests?.files).toEqual(['e2e/home.spec.ts', 'src/functions/book.test.ts']);
    expect(tests?.acceptance.slice(-2)).toEqual([
      {
        said: 'Its pages’ tests pass against the copy served',
        check: 'pnpm exec playwright test e2e/home.spec.ts --reporter=line'
      },
      { said: 'Its modules’ tests pass, and every test beside them', check: 'pnpm exec vitest run src/functions' }
    ]);
  });

  it('are a module’s alone, and checked by hand, in a project with no Playwright and no start script', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    plan.tasks[0].files.push('src/functions/book.ts');

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(checked.tasks.filter(task => task.testsOf !== undefined).map(task => [task.id, task.files])).toEqual([
      ['t-home-tests', ['src/functions/book.test.ts']]
    ]);
    // A task's acceptance held in a third test file of the folder, which the check never ran.
    expect(checked.tasks.find(task => task.id === 't-home-tests')?.acceptance).toContainEqual({
      said: 'Its modules’ tests pass, and every test beside them',
      check: "node --test 'src/functions/**/*.test.ts'"
    });
    // None of the project's yet: t-home has nothing of it to break.
    expect(checked.tasks.find(task => task.id === 't-home')?.touches).toBeUndefined();
  });

  // A tests card was handed `seedHistory.test.ts` to make, where `history.test.ts` tested the module already.
  it('takes a module’s tests from the test file that imports it already, not a name guessed', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    await bench.write('src/functions/history.test.ts', "import { seedHistory } from './seedHistory.ts';\n");
    const plan = benchPlan();
    plan.tasks[0].files.push('src/functions/seedHistory.ts');

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(checked.tasks.find(task => task.id === 't-home-tests')?.files).toEqual(['src/functions/history.test.ts']);
  });

  // T-shows-coming added an action, and the test that enumerates every action — its tests card's file — failed.
  it('gives a task the test file of the project its tests card takes, to fix what it breaks there first', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    await bench.write('src/functions/book.test.ts', "import test from 'node:test';\n");
    const plan = benchPlan();
    plan.tasks[0].files.push('src/functions/book.ts');

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(checked.tasks.find(task => task.id === 't-home')?.touches).toEqual(['src/functions/book.test.ts']);
    expect(checked.tasks.find(task => task.id === 't-home-tests')?.files).toEqual(['src/functions/book.test.ts']);
    expect(checked.notices.filter(notice => notice.includes('touches src/functions/book.test.ts'))).toEqual([]);
  });

  // A scout read two tasks "changing" a test file neither named: the run had given it to both.
  it('says a test two tasks at once may break as the run’s to give them, not as theirs', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    await bench.write(
      'src/functions/history.test.ts',
      "import { seedHistory } from './seedHistory.ts';\nimport { getChart } from './charts.ts';\n"
    );
    const plan = benchPlan();
    plan.tasks[0].files.push('src/functions/seedHistory.ts');
    plan.tasks[1].files.push('src/functions/charts.ts');

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(checked.notices.filter(notice => notice.includes('src/functions/history.test.ts'))).toEqual([
      expect.stringContaining(
        'src/functions/history.test.ts, a test of the project their change may break (the run gives it to them, to fix there what they break), is changed by "t-home" and "t-menu" at once'
      )
    ]);
  });

  // One developer, who wrote what they test: the tests are the tester's.
  it('hands a tester what the task it tests was asked, and what its reviews asked on top', async () => {
    await bench.write(
      'package.json',
      JSON.stringify({
        name: 'bench',
        type: 'module',
        private: true,
        devDependencies: { '@playwright/test': '^1.56.1' }
      })
    );
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-about');
    await writeInCopy(
      taken.work,
      'src/space/pages/about.ts',
      `export const about = { title: ${JSON.stringify('Sobre')} };\n`
    );
    const dev = bench.agent('dev-1', { token: taken.token });
    await completeTask(dev, 'es-launch', 't-about');
    await reviewTask(lead(), 'es-launch', 't-about', 'changes', [{ note: 'Say who we are, too' }]);
    await completeTask(dev, 'es-launch', 't-about');
    await reviewTask(lead(), 'es-launch', 't-about', 'approve', []);

    const tests = await takeTask(bench.agent('test-1'), 'es-launch', 't-about-tests');
    const context = await taskContext(bench.agent('test-1', { token: tests.token }), 'es-launch', 't-about-tests');
    expect(context.related.find(each => each.task === 't-about')?.asked).toEqual({
      acceptance: ['About reads in Spanish'],
      reviews: ['Review 1: Say who we are, too']
    });
  });

  // Carlos: the tests are a developer's work on Sonnet, the tester's Opus its reviews — never by who wrote the work.
  it('are a developer’s that did not write what they test — the tester’s only when no developer may', async () => {
    await bench.write(
      'package.json',
      JSON.stringify({
        name: 'bench',
        type: 'module',
        private: true,
        devDependencies: { '@playwright/test': '^1.56.1' }
      })
    );
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-about');
    await writeInCopy(taken.work, 'src/space/pages/about.ts', `export const page = { es: true };\n`);
    await completeTask(bench.agent('dev-1', { token: taken.token }), 'es-launch', 't-about');
    await reviewTask(bench.agent('test-1'), 'es-launch', 't-about', 'approve', []);

    expect((await nextTask(bench.agent('dev-2'), 'es-launch', 'developer')).ready).toContain('t-about-tests');
    const author = await nextTask(bench.agent('dev-1'), 'es-launch', 'developer');
    expect(author.ready).not.toContain('t-about-tests');
    expect(await refusalOf(takeTask(bench.agent('dev-1'), 'es-launch', 't-about-tests'))).toContain(
      'worked what t-about-tests tests (t-about)'
    );
    expect(await refusalOf(reassignTask(lead(), 'es-launch', 't-about-tests', { to: 'dev-1' }))).toContain(
      'hand it to one that did not write the work'
    );
    // A developer may: the tester reviews, it writes none.
    expect(await refusalOf(takeTask(bench.agent('test-1'), 'es-launch', 't-about-tests'))).toContain(
      'is a tester of the team, not a developer'
    );
    await takeTask(bench.agent('dev-2'), 'es-launch', 't-about-tests');
  });

  it('refuses a task whose role nobody in the team takes', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = benchPlan();
    plan.tasks[0].role = 'writer';

    expect(await refusalOf(checkPlanFile(lead(), await bench.writePlan(plan)))).toContain(
      `nobody in the team (${TEAM_FILE}) takes writer`
    );
  });
});

describe('who reviews a card', () => {
  // Carlos: the card says which roles review it — a run's designer looked at no card it was not asked to.
  it('is the card’s to say: with a designer in the team, a card that changes a page with none is said', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan('said');
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, review: ['designer', 'tester'] } : task));
    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    const notice = checked.notices.find(each => each.includes('with no designer in'));
    expect(notice).toBeDefined();
    expect(notice).not.toContain('t-menu');
  });

  it('is its card’s roles, a role nobody takes standing as the default reviewer — said at complete', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = designed(benchPlan());
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    const state = await readState(taskPaths((await loadRun(lead(), 'es-launch')).paths, 't-menu'));
    expect(state.review).toMatchObject({ step: 0, round: 0 });
    expect(state.notes.at(-1)?.text).toContain('its review goes lead');
  });
});

describe('a project’s first run', () => {
  it('writes the team its plan needs, with what each field and role means, saying so', async () => {
    const plan = benchPlan();
    plan.tasks[3].role = 'writer';

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(checked.notices[0]).toContain('This project had no team: .plitzi/team.json written');
    const written = await readTeam(bench.root);
    // It says what each field and role means: the file has no comments.
    expect(written?.about).toMatchObject({ roles: { tester: expect.stringContaining('<task>-tests') as unknown } });
    expect(written).toMatchObject({
      version: 1,
      agents: [
        { name: 'dev', roles: ['developer'] },
        { name: 'design', roles: ['designer'] },
        { name: 'test', roles: ['tester'] },
        { name: 'scout', roles: ['scout'] },
        { name: 'writer', roles: ['writer'] }
      ]
    });
    expect(checked.estimate.agents).toBe(3);
  });

  it('refuses a team somebody emptied, with how to fill it', async () => {
    await bench.writeTeam({ version: 1, agents: [] });

    expect(await refusalOf(checkPlanFile(lead(), await bench.writePlan(benchPlan())))).toContain(
      'has no agents: a run is worked by it'
    );
  });
});

describe('a task held behind one in review', () => {
  it('tells the lead while agents of its role have nothing to take — and how to free it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu' || task.id === 't-book');
    plan.tasks[1].dependsOn = ['t-menu'];
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'held-up',
        task: 't-book',
        // dev-2 never joined: a member of the team nobody started is not free ("design-2 is free", unstarted).
        text: expect.stringMatching(
          /t-book waits for t-menu \((.* )?review\) while dev-1 is free: they share no file/
        ) as unknown
      })
    );
  });

  // A task that fills what the held one writes — by touches — needs it: never told to take the dependency away.
  it('says what they share when the task touches a file the one it waits for writes', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu' || task.id === 't-book');
    plan.tasks[1] = { ...plan.tasks[1], dependsOn: ['t-menu'], touches: ['src/space/pages/menu.ts'] };
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    const held = (await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'held-up');
    expect(held?.text).toContain('they share src/space/pages/menu.ts');
  });

  it('tells the lead of a review past its time, never before — and how to decide it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = designed(benchPlan());
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    const kinds = async () => (await viewRun(lead(), 'es-launch')).attention.map(item => item.kind);

    expect(await kinds()).not.toContain('slow-review');
    // Its first review holds its reading too (15 min): halfway, with dev-1 idle, the lead still has nothing to ask — an
    // idle agent could not have taken it (a run's lead was woken at 4 min of every long review).
    bench.advance(8 * 60_000);
    expect(await kinds()).not.toContain('slow-review');
    // Past the review's time it is no longer the designer's: said so.
    bench.advance(8 * 60_000);
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'slow-review',
        text: expect.stringContaining("design-1 has held t-menu's designer review 16 min, past the 15") as unknown
      })
    );
  });

  it('says nothing while they have a ready task to take', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    expect((await viewRun(lead(), 'es-launch')).attention.map(item => item.kind)).not.toContain('held-up');
  });
});

describe('a designer’s step of a card’s review', () => {
  beforeEach(async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'], count: 2 });
    await openRun(lead(), await bench.writePlan(designed(benchPlan())));
  });

  // Design-1 reviewed t-lint's UI, and the monitor said it was idle — the flow said otherwise.
  it('shows a designer at the step it took as at it, in the monitor', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

    const designer = (await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'design-1');
    expect(designer).toMatchObject({ task: 't-menu' });
    expect(designer?.status).not.toBe('idle');
  });

  it('hands a designer its step with how closely the team asks, standard when it says nothing', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    expect((await takeNext(bench.agent('design-1'), 'es-launch', 'designer')).next.review?.precision).toBe('standard');
  });

  // Design-1 read its reading list after its first verdict — said mid-line, on every review.
  it('says it is its first review on the first, and not again on the next', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await completed('dev-2', 't-about', 'src/space/pages/about.ts');
    const first = (await takeNext(bench.agent('design-1'), 'es-launch', 'designer')).next.review;
    expect(first?.first).toBe(true);
    await reviewTask(bench.agent('design-1'), 'es-launch', first?.task.id ?? '', 'approve', []);

    const second = (await takeNext(bench.agent('design-1'), 'es-launch', 'designer')).next.review;
    expect(second?.task.id).not.toBe(first?.task.id);
    expect(second?.first).toBeUndefined();
  });

  it('comes first: offered to one designer, approved by it, then its next step’s — the lead not woken for it', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    expect(await reviewOf('t-menu')).toMatchObject({ round: 0, step: 0 });
    expect(leadItems(await viewRun(lead(), 'es-launch')).map(item => item.key)).not.toContainEqual(
      expect.stringContaining('review:t-menu')
    );

    // A designer is offered it before any task, and takes it; the other is not offered it.
    const { next } = await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect(next.review).toMatchObject({ task: { id: 't-menu' }, role: 'designer', steps: ['designer', 'lead'] });
    expect(await reviewOf('t-menu')).toMatchObject({ step: 0, by: 'design-1' });
    expect((await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).review).toBeUndefined();
    expect(await refusalOf(reviewTask(bench.agent('design-2'), 'es-launch', 't-menu', 'approve', []))).toContain(
      'design-1 reviews t-menu'
    );

    expect(await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [])).toEqual({
      verdict: 'approve',
      round: 0,
      passed: { role: 'designer', next: 'lead' }
    });
    // Its next step is the lead's — no tester in the team: the lead is woken for it now.
    expect(leadItems(await viewRun(lead(), 'es-launch'))).toContainEqual(
      expect.objectContaining({ key: expect.stringContaining('review:t-menu:0:1') as unknown })
    );
    bench.advance(10 * 60_000);
    expect((await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).merged).toEqual([
      'src/space/pages/menu.ts'
    ]);
    // The report reads the card approved by its last step, the steps before it said in order — not by the first one.
    const reported = (await buildReport(lead(), await loadRun(lead(), 'es-launch'))).tasks.find(
      task => task.id === 't-menu'
    );
    expect(reported?.reviewedBy).toEqual(['designer: design-1', 'lead: lead']);
    expect(reported?.minutes).toBeGreaterThanOrEqual(10);
  });

  it('sends changes back as any step’s would, said in the activity as its step’s', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect(
      await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'changes', [{ note: 'Tighter at 390' }])
    ).toMatchObject({ verdict: 'changes', round: 1 });
    const log = await readRunLog((await loadRun(lead(), 'es-launch')).paths);
    expect(log.findLast(entry => entry.action === 'review')).toMatchObject({ verdict: 'changes', step: 'designer' });
  });

  it('tells a designer the lead decided while it reviewed — the lead’s word goes on any step', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).toMatchObject({ verdict: 'approve' });
    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).filter(message => message.to === '@design-1');
    expect(told.map(message => message.text).join(' ')).toContain('decided t-menu (approved) while you reviewed it');
  });

  it('offers a round sent back to the designer who said the one before first', async () => {
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const dev = bench.agent('dev-1', { token: taken.token });
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', "export const menu = { title: 'Menu' };\n");
    await completeTask(dev, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-2'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-2'), 'es-launch', 't-menu', 'changes', [{ note: 'Light rows' }]);
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', "export const menu = { title: 'Menú' };\n");
    await completeTask(dev, 'es-launch', 't-menu');

    // Its session ends with its review (session: task): its fresh start asks again.
    expect((await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).finished).toBe(true);
    const again = (await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).review;
    expect(again).toMatchObject({ task: { id: 't-menu' }, round: 1 });
    expect(again?.before).toBeUndefined();
    expect((await nextTask(bench.agent('design-1'), 'es-launch', 'designer')).review?.before).toBe('design-2');
  });

  it('takes a step held past its time from its designer — another takes it, the first is told and refused after', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect((await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).review).toBeUndefined();

    bench.advance(REVIEW_TIMEOUT_MS + FIRST_REVIEW_READING_MS + 60_000);
    expect((await takeNext(bench.agent('design-2'), 'es-launch', 'designer')).next.review?.task.id).toBe('t-menu');
    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).filter(message => message.to === '@design-1');
    expect(told.map(message => message.text).join(' ')).toContain("t-menu's designer review went to design-2");
    expect(await refusalOf(reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []))).toContain(
      'design-2 reviews t-menu'
    );
  });

  it('hands the next step what the designer saw with its approval', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [
      { note: 'A puppy under a month would read 0 — worth a look' }
    ]);
    const offered = (await nextTask(lead(), 'es-launch', 'lead')).review;
    expect(offered?.passed?.join(' ')).toContain('A puppy under a month would read 0');
  });

  it('keeps a designer waiting while a card whose review names it is still to be done', async () => {
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const waiting = await nextTask(bench.agent('design-1'), 'es-launch', 'designer');
    expect(waiting.finished).toBeUndefined();
  });
});
