import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { auditRun } from './audit';
import { expectedIds } from './expectations';
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
import { meantOnPage } from '../commands/check';
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

  it('comes before the lead’s: offered to one designer, approved by it, then the lead’s to approve', async () => {
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    expect(await designOf('t-menu')).toEqual({ status: 'due', round: 0 });

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
    expect(said).toMatchObject({ from: 'design-2', to: 'lead', text: 'On t-about: The footer wraps at 390' });
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
    expect(await designOf('t-menu')).toEqual({ status: 'due', round: 2 });
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

describe('a stage’s plan, and what its checks expect', () => {
  it('amends a run from the plan of a stage stacked on it: its tasks, and the run’s goal kept', async () => {
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const stage = {
      version: 1 as const,
      runId: 'es-launch-2',
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
    await extendRun(lead(), 'es-launch', await bench.writePlan(stage));
    stage.tasks[0].acceptance = ['It says how to reach us, and when'];

    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(stage))).toMatchObject({
      tasks: [{ task: 't-contact', changed: ['acceptance'] }]
    });
    const plan = (await loadRun(lead(), 'es-launch')).plan;
    expect(plan.goal).toBe('Spanish version of the pages · The contact page');
    expect(plan.tasks.map(task => task.id)).toContain('t-home');
  });

  it('reads the ids a page check expects, and says the page family’s for an id it scopes', () => {
    expect(
      expectedIds(
        'plitzi page check /pets/luna --url $PLITZI_URL --expect "/pets/luna age-label~old" --expect=title~Luna && echo ok'
      )
    ).toEqual([{ element: 'age-label', path: '/pets/luna' }, { element: 'title' }]);
    expect(meantOnPage('age-label', ['pet-luna-age-label', 'pet-kira-age-label', 'title'])).toContain(
      'one a page: pet-luna-age-label, pet-kira-age-label'
    );
    expect(meantOnPage('age-label', ['pet-luna-age-label'])).toContain('did you mean pet-luna-age-label?');
  });
});

describe('a check as any shell runs it', () => {
  it('has the copy served written in, and knows a Playwright spec needs it served', async () => {
    const { namesServedCopy, withServedValues } = await import('./acceptance');
    const values = { PLITZI_URL: 'http://127.0.0.1:8211', PLITZI_PORT: '8211' };

    expect(withServedValues('plitzi page check / --url $PLITZI_URL && echo ${PLITZI_PORT} $HOME', values)).toBe(
      'plitzi page check / --url http://127.0.0.1:8211 && echo 8211 $HOME'
    );
    expect(namesServedCopy('npx playwright test visual/walks.spec.ts')).toBe(true);
    expect(namesServedCopy('node --test src/space/lib/age.test.ts')).toBe(false);
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
