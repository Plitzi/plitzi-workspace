import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditRun } from './audit';
import { REVIEW_TIMEOUT_MS, SAME_DESIGNER_MS } from './design';
import { extendRun } from './extend';
import { leadItems } from './leadWatch';
import { messagesOf } from './messages';
import { monitorRun } from './monitor';
import { taskPaths } from './paths';
import { isRunRefusal } from './refusal';
import { checkPlanFile, loadRun, openRun, readRunLog } from './run';
import { tellLeadAbout } from './talk';
import { completeTask, nextTask, reviewTask, takeNext, takeTask, taskContext } from './tasks';
import { readState } from './taskStore';
import { readTeam, setTeamAgent, TEAM_FILE } from './team';
import { testFilesFor } from './tests';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';

import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

/** A run worked by the project's team (`.plitzi/team.json`): its size, its tester's tasks, its designer's reviews. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const lead = (): RunContext => bench.agent('lead');

const refusalOf = async (work: Promise<unknown>): Promise<string> => {
  const refused = await work.then(
    () => undefined,
    (error: unknown) => error
  );

  return isRunRefusal(refused) ? refused.message : 'not refused';
};

/** A developer takes a task, writes it and completes it: in review, as its agent leaves it. */
const completed = async (name: string, taskId: string, file: string): Promise<void> => {
  const taken = await takeTask(bench.agent(name), 'es-launch', taskId);
  await writeInCopy(taken.work, file, `export const page = { title: '${taskId}' };\n`);
  await completeTask(bench.agent(name, { token: taken.token }), 'es-launch', taskId);
};

const designOf = async (taskId: string) =>
  (await readState(taskPaths((await loadRun(lead(), 'es-launch')).paths, taskId))).design;

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

  it('are a tester’s task after each one — none for one that says tests: false — and the team is the run’s size', async () => {
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
    const tests = checked.tasks.filter(task => task.role === 'tester');
    expect(tests.map(task => [task.id, task.dependsOn, task.files])).toEqual([
      ['t-home-tests', ['t-home'], ['visual/home.spec.ts']],
      ['t-menu-tests', ['t-menu'], ['visual/menu.spec.ts']],
      ['t-book-tests', ['t-book'], ['visual/book.spec.ts']]
    ]);
    expect(tests[0]?.acceptance.at(-1)).toEqual({
      said: 'Its pages’ tests pass against the copy served',
      check: 'npx playwright test visual/home.spec.ts --reporter=line'
    });
    expect(checked.notices).toContainEqual(expect.stringContaining('A tester writes the tests'));
    expect(checked.estimate.agents).toBe(3);
  });

  it('are a module’s alone, and checked by hand, in a project with no Playwright and no start script', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    plan.tasks[0].files.push('src/functions/book.ts');

    const checked = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(checked.tasks.filter(task => task.role === 'tester').map(task => [task.id, task.files])).toEqual([
      ['t-home-tests', ['src/functions/book.test.ts']]
    ]);
  });

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

  it('refuses a task whose role nobody in the team takes', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = benchPlan();
    plan.tasks[0].role = 'writer';

    expect(await refusalOf(checkPlanFile(lead(), await bench.writePlan(plan)))).toContain(
      `nobody in the team (${TEAM_FILE}) takes writer`
    );
  });
});

describe('whether a run reviews design', () => {
  it('is the plan’s to say — on with a designer in the team, off with none, unless it says otherwise', async () => {
    const off = { ...benchPlan('off'), designReview: false };
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'] });
    await openRun(lead(), await bench.writePlan(off));
    expect((await loadRun(lead(), 'off')).record.designReview).toBeUndefined();
  });

  it('stays the run’s choice when a stage is stacked on it — on only when the stage says so', async () => {
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'] });
    await openRun(lead(), await bench.writePlan({ ...benchPlan('off'), designReview: false }));
    const stage = {
      version: 1 as const,
      runId: 'off-2',
      goal: 'The contact page',
      tasks: [
        {
          id: 't-contact',
          title: 'Contact',
          files: ['src/space/pages/contact.ts'],
          dependsOn: [],
          priority: 'low' as const,
          estimateMinutes: 10,
          acceptance: ['It says how to reach us']
        }
      ]
    };
    await extendRun(lead(), 'off', await bench.writePlan(stage));
    expect((await loadRun(lead(), 'off')).record.designReview).toBeUndefined();
    await extendRun(
      lead(),
      'off',
      await bench.writePlan({
        ...stage,
        runId: 'off-3',
        designReview: true,
        tasks: [{ ...stage.tasks[0], id: 't-legal', files: ['src/space/pages/legal.ts'] }]
      })
    );
    expect((await loadRun(lead(), 'off')).record.designReview).toBe(true);
    const off = await refusalOf(
      extendRun(
        lead(),
        'off',
        await bench.writePlan({
          ...stage,
          runId: 'off-4',
          designReview: false,
          tasks: [{ ...stage.tasks[0], id: 't-faq', files: ['src/space/pages/faq.ts'] }]
        })
      )
    );
    expect(off).toContain('a stage keeps that');
  });

  it('is on for a run whose plan asks for it, with a team of no designer', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await openRun(lead(), await bench.writePlan({ ...benchPlan('on'), designReview: true }));
    expect((await loadRun(lead(), 'on')).record.designReview).toBe(true);
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

describe('a UI review with no designer free', () => {
  it('is the lead’s too — said, approved with --skip-design — rather than waiting for nobody', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    // The designer between tasks would take it: the lead is not offered it.
    expect((await nextTask(lead(), 'es-launch', 'lead')).leadReview).toBeUndefined();

    // At a task of its own, it is nobody's to take but the lead's.
    await takeTask(bench.agent('design-1'), 'es-launch', 't-about');
    const offered = await nextTask(lead(), 'es-launch', 'lead');
    expect(offered.leadReview).toMatchObject({ task: { id: 't-menu' } });
    expect(offered.leadReview?.uiToo).toContain('design-1 at a task of its own');
    // And the lead hears it, as one waiting for nobody would never be said otherwise.
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({ kind: 'ui-waits', text: expect.stringContaining('design-1 at t-about') as unknown })
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
        text: expect.stringMatching(
          /t-book waits for t-menu \(.* review\) while dev-1, dev-2 are free: they share no file/
        ) as unknown
      })
    );
  });

  it('tells the lead of a review taken long ago while nobody has work — and how to decide it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    const kinds = async () => (await viewRun(lead(), 'es-launch')).attention.map(item => item.kind);

    expect(await kinds()).not.toContain('slow-review');
    bench.advance(5 * 60_000);
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'slow-review',
        text: expect.stringContaining(
          "design-1 has had t-menu's UI review 5 min while dev-1 has nothing to take"
        ) as unknown
      })
    );
    // Past the review's time it is no longer the designer's: said so, idle team or not.
    bench.advance(6 * 60_000);
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'slow-review',
        text: expect.stringContaining("design-1 has held t-menu's UI review 11 min, past the 8") as unknown
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

describe('a designer’s review of the others’ UI', () => {
  beforeEach(async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'], count: 2 });
    await openRun(lead(), await bench.writePlan(benchPlan()));
  });

  // la-velada: design-1 reviewed t-lint's UI, and the monitor said it was idle — the flow said otherwise.
  it('shows a designer at the UI review it took as reviewing, in the monitor', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

    const designer = (await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'design-1');
    expect(designer).toMatchObject({ status: 'reviewing', task: 't-menu', doing: 'reviews the UI of t-menu' });
  });

  it('hands a designer its review with how closely the team asks, standard when it says nothing', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    expect((await takeNext(bench.agent('design-1'), 'es-launch', 'designer')).next.designReview?.precision).toBe(
      'standard'
    );
  });

  // velada-backlog: design-1 read its reading list after its first verdict — said mid-line, on every review.
  it('says what to read before a designer’s first review, and not again on the next', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await completed('dev-2', 't-about', 'src/space/pages/about.ts');
    const first = (await takeNext(bench.agent('design-1'), 'es-launch', 'designer')).next.designReview;
    expect(first?.first).toBe(true);
    await reviewTask(bench.agent('design-1'), 'es-launch', first?.task.id ?? '', 'approve', []);

    const second = (await takeNext(bench.agent('design-1'), 'es-launch', 'designer')).next.designReview;
    expect(second?.task.id).not.toBe(first?.task.id);
    expect(second?.first).toBeUndefined();
  });

  it('comes before the lead’s: offered to one designer, approved by it, then the lead’s to approve', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    expect(await designOf('t-menu')).toEqual({ status: 'due', round: 0, since: expect.any(String) as unknown });

    // The lead does not approve before it — unless it says so — and is not woken for it.
    expect(await refusalOf(reviewTask(lead(), 'es-launch', 't-menu', 'approve', []))).toContain('--skip-design');
    expect(leadItems(await viewRun(lead(), 'es-launch'), bench.now()).map(item => item.key)).not.toContainEqual(
      expect.stringContaining('review:t-menu')
    );

    // A designer is offered it before any task, and takes it; the other is not offered it.
    const { next } = await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect(next.designReview).toMatchObject({ task: { id: 't-menu' }, changed: ['src/space/pages/menu.ts'] });
    expect(await designOf('t-menu')).toMatchObject({ status: 'due', by: 'design-1' });
    expect((await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).designReview).toBeUndefined();
    expect(await refusalOf(reviewTask(bench.agent('design-2'), 'es-launch', 't-menu', 'approve', []))).toContain(
      'design-1 reviews t-menu'
    );

    expect(await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [])).toEqual({
      verdict: 'approve',
      round: 0,
      design: 'approved'
    });
    expect(leadItems(await viewRun(lead(), 'es-launch'), bench.now())).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining('its UI approved by design-1') as unknown })
    );
    expect((await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).merged).toEqual([
      'src/space/pages/menu.ts'
    ]);
  });

  it('sends changes back to the task as the lead’s would, and the lead may approve without it, said', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect(
      await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'changes', [
        { note: 'The prices sit too close to the names at 390' }
      ])
    ).toMatchObject({ verdict: 'changes', round: 1 });
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-menu')?.status).toBe(
      'changes-requested'
    );

    await completed('dev-2', 't-about', 'src/space/pages/about.ts');
    expect(
      await reviewTask(lead(), 'es-launch', 't-about', 'approve', [], 'refuse', { skipDesign: 'no-ui' })
    ).toMatchObject({ design: 'skipped', designSkip: 'no-ui' });
    expect(await designOf('t-about')).toMatchObject({ status: 'skipped', by: 'lead', why: 'no-ui' });
  });

  it('says the designer’s changes as its UI review’s, and tells a designer the lead went past', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'changes', [{ note: 'Tighter at 390' }]);
    const log = async () => readRunLog((await loadRun(lead(), 'es-launch')).paths);
    expect((await log()).at(-1)).toMatchObject({ action: 'design-review', verdict: 'changes', task: 't-menu' });

    await completed('dev-2', 't-about', 'src/space/pages/about.ts');
    await takeNext(bench.agent('design-2'), 'es-launch', 'designer');
    await reviewTask(lead(), 'es-launch', 't-about', 'approve', [], 'refuse', { skipDesign: 'lead' });
    expect((await log()).find(entry => entry.action === 'review' && entry.task === 't-about')).toMatchObject({
      design: 'skipped',
      designSkip: 'lead',
      designBy: 'design-2'
    });
    // Said as the lead's UI review, never as one nobody made.
    expect(await auditRun(await loadRun(lead(), 'es-launch'))).toContain(
      'Their UI reviewed by the lead, not a designer: t-about'
    );
    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(message => message.to === '@design-2');
    expect(told?.text).toContain('t-about is approved without its UI review');

    // Its finding still reaches the lead, by its name, though it holds no task.
    const said = await tellLeadAbout(bench.agent('design-2'), 'es-launch', 't-about', 'The footer wraps at 390');
    expect(said).toMatchObject({
      from: 'design-2',
      to: 'lead',
      text: 'On t-about: The footer wraps at 390',
      about: 't-about'
    });
    // About a task approved already: in the inbox, its history, but nothing that holds the run's finish.
    expect((await viewRun(lead(), 'es-launch')).attention.map(item => item.text)).not.toContainEqual(
      expect.stringContaining('The footer wraps at 390')
    );
    expect(await refusalOf(tellLeadAbout(bench.agent('nobody'), 'es-launch', 't-about', 'Hi'))).toContain(
      'is no agent of the team'
    );
  });

  it('asks the review its developer says: the code alone goes straight to the lead, said in the activity', async () => {
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', 'export const page = { title: `t-menu` };\n');
    await completeTask(bench.agent('dev-1', { token: taken.token }), 'es-launch', 't-menu', { review: 'code' });

    expect(await designOf('t-menu')).toBeUndefined();
    expect((await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).merged).toEqual([
      'src/space/pages/menu.ts'
    ]);
    const log = await readRunLog((await loadRun(lead(), 'es-launch')).paths);
    expect(log.find(entry => entry.action === 'complete' && entry.task === 't-menu')).toMatchObject({ review: 'code' });
  });

  it('lets a designer’s approval stand for a round of changes that did not touch the UI', async () => {
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const dev = bench.agent('dev-1', { token: taken.token });
    await writeInCopy(
      taken.work,
      'src/space/pages/menu.ts',
      `export const menu = { title: ${JSON.stringify('Menú')} };\n`
    );
    await completeTask(dev, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []);
    await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Say why in the commit' }]);

    // Done again with the page as the designer saw it: its approval stands, said.
    await completeTask(dev, 'es-launch', 't-menu');
    expect(await designOf('t-menu')).toMatchObject({ status: 'approved', by: 'design-1', round: 1 });
    expect(
      (await readState(taskPaths((await loadRun(lead(), 'es-launch')).paths, 't-menu'))).notes.at(-1)?.text
    ).toContain('Its UI is as design-1 approved it');

    // Changed again: a designer looks at it again.
    await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'A shorter title' }]);
    await writeInCopy(
      taken.work,
      'src/space/pages/menu.ts',
      `export const menu = { title: ${JSON.stringify('Carta')} };\n`
    );
    await completeTask(dev, 'es-launch', 't-menu');
    // Its UI changed: due again — first for the designer who said the round before.
    expect(await designOf('t-menu')).toEqual({
      status: 'due',
      round: 2,
      before: 'design-1',
      since: expect.any(String) as unknown
    });
  });

  // velada-polish: design-2 said t-match-bars's first round, design-1 its second — with asks of its own, a round more.
  it('offers a round sent back to the designer who said the one before, and another only past a wait', async () => {
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const dev = bench.agent('dev-1', { token: taken.token });
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', "export const menu = { title: 'Menu' };\n");
    await completeTask(dev, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'changes', [{ note: 'Tighter at 390' }]);
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', "export const menu = { title: 'Menú' };\n");
    await completeTask(dev, 'es-launch', 't-menu');

    expect((await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).designReview).toBeUndefined();
    expect((await nextTask(bench.agent('design-1'), 'es-launch', 'designer')).designReview?.task.id).toBe('t-menu');

    bench.advance(SAME_DESIGNER_MS);
    const other = (await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).designReview;
    expect(other).toMatchObject({ task: { id: 't-menu' }, before: 'design-1' });
  });

  // velada-fidelity: design-1 held t-prediction-card's review 16 min, t-result-card queued 18 min behind it.
  it('takes a review held past its time from its designer — another takes it, the first is told and refused after', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    expect((await nextTask(bench.agent('design-2'), 'es-launch', 'designer')).designReview).toBeUndefined();

    bench.advance(REVIEW_TIMEOUT_MS + 60_000);
    const { next } = await takeNext(bench.agent('design-2'), 'es-launch', 'designer');
    expect(next.designReview?.task.id).toBe('t-menu');
    expect(await designOf('t-menu')).toMatchObject({ status: 'due', by: 'design-2' });
    const loaded = await loadRun(lead(), 'es-launch');
    expect((await readRunLog(loaded.paths)).find(entry => entry.action === 'review-timed-out')).toMatchObject({
      task: 't-menu',
      from: 'design-1',
      to: 'design-2',
      minutes: 9
    });
    const told = (await messagesOf(loaded)).find(message => message.to === '@design-1');
    expect(told?.text).toContain("t-menu's UI review went to design-2: you held it 9 min");
    expect(await refusalOf(reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []))).toContain(
      'design-2 reviews t-menu'
    );
  });

  // velada-fidelity: the lead said t-result-card's next round was its own; the CLI handed it to design-1 all the same.
  it('keeps a round the lead sent back as its own the lead’s: no designer is offered it, and one at it is told', async () => {
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const dev = bench.agent('dev-1', { token: taken.token });
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', "export const menu = { title: 'Menu' };\n");
    await completeTask(dev, 'es-launch', 't-menu');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

    await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Light rows' }], 'refuse', {
      skipDesign: 'lead'
    });
    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(message => message.to === '@design-1');
    expect(told?.text).toContain('lead sent t-menu back while you reviewed its UI');

    await writeInCopy(taken.work, 'src/space/pages/menu.ts', "export const menu = { title: 'Menú' };\n");
    await completeTask(dev, 'es-launch', 't-menu');
    expect(await designOf('t-menu')).toMatchObject({ status: 'skipped', why: 'lead', by: 'lead' });
    expect((await nextTask(bench.agent('design-1'), 'es-launch', 'designer')).designReview).toBeUndefined();
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).toMatchObject({ verdict: 'approve' });
  });

  it('hands the lead what the designer saw with its approval, and the agent what the lead asked with its task', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [
      { note: 'A puppy under a month would read 0 — worth a look' }
    ]);
    expect(
      (await readState(taskPaths((await loadRun(lead(), 'es-launch')).paths, 't-menu'))).notes.at(-1)?.text
    ).toContain('the lead’s now — A puppy under a month would read 0');

    await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Days and weeks under a month' }]);
    const back = await nextTask(bench.agent('dev-1'), 'es-launch', 'developer');
    expect(back).toMatchObject({ yours: 'changes-requested', asked: ['lead: Days and weeks under a month'] });
  });

  it('keeps a designer waiting while a task whose UI it may review is still to be done', async () => {
    const waiting = await nextTask(bench.agent('design-1'), 'es-launch', 'designer');
    expect(waiting.finished).toBeUndefined();
    expect(waiting.why).toContain('is yours to review once it is in review');
  });
});

describe('a designer, once it sent a task back', () => {
  it('keeps a designer waiting for a task it sent back whose files are data, but whose changes reached a page', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan('data-run');
    plan.tasks = [{ ...plan.tasks[3], id: 't-data', files: ['src/data/menu.json'] }];
    await openRun(lead(), await bench.writePlan(plan));
    const taken = await takeTask(bench.agent('dev-1'), 'data-run', 't-data');
    await writeInCopy(taken.work, 'src/data/menu.json', '{ "items": [{ "id": "tea" }] }\n');
    // A page it reads changed too, taken by turns at complete: what a person sees changed.
    await writeInCopy(
      taken.work,
      'src/space/pages/about.ts',
      `export const about = { title: ${JSON.stringify('Tea')} };\n`
    );
    await completeTask(bench.agent('dev-1', { token: taken.token }), 'data-run', 't-data');
    await takeNext(bench.agent('design-1'), 'data-run', 'designer');
    await reviewTask(bench.agent('design-1'), 'data-run', 't-data', 'changes', [{ note: 'The tea has no price' }]);

    const after = await nextTask(bench.agent('design-1'), 'data-run', 'designer');
    expect(after.finished).toBeUndefined();
    expect(after.why).toContain('t-data');
  });
});

// A designer at a task of its own left every UI review to the lead: it waits for the reviews coming instead.
describe('a designer that develops too', () => {
  beforeEach(async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 1 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
  });

  it('waits for the UI reviews coming rather than taking a task of its own, and takes one once none is', async () => {
    const menu = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const waiting = await nextTask(bench.agent('design-1'), 'es-launch', 'designer,developer');
    expect([waiting.task?.id, waiting.why]).toEqual([
      undefined,
      expect.stringContaining('UI reviews are coming — t-menu (dev-1) at work') as unknown
    ]);

    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "t-menu" };\n');
    await completeTask(bench.agent('dev-1', { token: menu.token }), 'es-launch', 't-menu');
    expect((await nextTask(bench.agent('design-1'), 'es-launch', 'designer,developer')).designReview?.task.id).toBe(
      't-menu'
    );
  });
});
