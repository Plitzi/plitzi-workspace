import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addBacklogItem } from './backlog';
import { checkedAfter } from './expectations';
import { abortRun } from './merge';
import { EVERYONE, messagesOf } from './messages';
import { readOwnership } from './ownership';
import { RUNS_DIR, runPaths } from './paths';
import { checkPlan, findCycle, PlanRefusal } from './plan';
import { runPlanProblems } from './planProblems';
import { isRunRefusal } from './refusal';
import { loadRun, openRun } from './run';
import { completeTask, nextTask, takeTask } from './tasks';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** Plans held to the rules, and runs opened: ownership, the rules, how many agents. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, openWith, open, take } = runSteps(() => bench);

describe('who owns which file, read off the imports', () => {
  it('gives a root the modules only it reaches, and shares what several reach', async () => {
    const ownership = await readOwnership(bench.root);

    expect(ownership.ownerOf.get('src/space/pages/home/hero.ts')).toBe('src/space/pages/home/index.ts');
    expect(ownership.shared.get('src/space/theme.ts')).toEqual([
      'src/space/pages/book.ts',
      'src/space/pages/home/index.ts',
      'src/space/pages/menu.ts',
      'src/space/theme.ts'
    ]);
    expect(ownership.shared.has('src/space/tokens.ts')).toBe(true);
    expect(ownership.shared.has('src/space/index.ts')).toBe(true);
    expect(ownership.ownerOf.get('src/space/pages/about.ts')).toBe('src/space/pages/about.ts');
  });

  // A page that imports a plugin's declaration reads its contract: the plugin's folder stays the plugin's alone.
  it('keeps a plugin’s folder whole, whoever imports its declaration', async () => {
    await bench.write(
      'src/space/pages/about.ts',
      `import badge from '../../plugins/Badge/declaration.ts';

export const about = { id: 'about', badge };
`
    );
    const ownership = await readOwnership(bench.root);

    expect(ownership.ownerOf.get('src/plugins/Badge/declaration.ts')).toBe('src/plugins/Badge/');
    expect(ownership.shared.has('src/plugins/Badge/declaration.ts')).toBe(false);
  });
});

describe('a plan held to the rules', () => {
  it('holds the job to its inventory: each piece covered by a checked line, or left out with its reason', async () => {
    const plan = benchPlan();
    plan.inventory = [
      { id: 'home-hero', piece: 'the hero', page: '/' },
      { id: 'tier-list', piece: 'the tier list builder', page: '/tier-list' },
      { id: 'overlay', piece: 'the stream overlay', page: '/overlay', leftOut: 'for streamers, a second run' }
    ];
    const check = async () =>
      checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3)).then(
        () => [],
        (error: unknown) => (error instanceof PlanRefusal ? error.problems : [String(error)])
      );

    plan.tasks[0].acceptance = [{ said: 'The hero says Hola', check: 'true', covers: ['home-hero', 'tier-lst'] }];
    expect(await check()).toEqual([
      'Task "t-home" covers "tier-lst", which the inventory does not list',
      expect.stringContaining('inventory "tier-list" (the tier list builder, /tier-list) is in no task')
    ]);

    plan.tasks[0].acceptance = [{ said: 'The hero says Hola', check: 'true', covers: ['home-hero', 'overlay'] }];
    plan.tasks[1].acceptance = [{ said: 'The tier list drags', check: 'true', covers: ['tier-list'] }];
    expect(await check()).toEqual([expect.stringContaining('inventory "overlay" is left out')]);

    plan.tasks[0].acceptance = [{ said: 'The hero says Hola', check: 'true', covers: ['home-hero'] }];
    const read = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));
    expect(read.leftOut).toEqual(['the stream overlay (/overlay) — for streamers, a second run']);
    expect(read.notices).toContain('The inventory: 3 pieces — 2 covered by a task’s checked acceptance, 1 left out');
    // A covering line is one a command proves: a sentence covers nothing.
    expect(
      runPlanProblems({ ...plan, tasks: [{ ...plan.tasks[0], acceptance: [{ said: 'x', covers: ['home-hero'] }] }] })
    ).toEqual([expect.stringContaining('a line that covers a piece of the inventory is one a command checks')]);
  });

  // T-base held src/space/pages to write the stubs, each a later task's file — complete refused them mid-run.
  it('refuses a task holding a folder another task’s files are in, naming the shape that works', async () => {
    const plan = benchPlan();
    plan.tasks[0].files = ['src/space/pages/shop'];
    plan.tasks[1].files = ['src/space/pages/shop/cart.ts'];
    const problems = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3)).then(
      () => [],
      (error: unknown) => (error instanceof PlanRefusal ? error.problems : [String(error)])
    );

    expect(problems).toContainEqual(
      expect.stringContaining(
        'Task "t-home" holds src/space/pages/shop, a folder with src/space/pages/shop/cart.ts ("t-menu") in it'
      )
    );
  });

  // T-card measured its card on the collection page t-collection made — and t-collection waited for t-card.
  it('finds a later task checking the same missing page: the check before it cannot pass — a deadlock', () => {
    const tasks = [
      { id: 't-card', dependsOn: [] },
      { id: 't-collection', dependsOn: ['t-card'] },
      { id: 't-home', dependsOn: ['t-card'] }
    ];
    const asked = [
      { task: 't-card', path: '/collections/laptops' },
      { task: 't-collection', path: '/collections/laptops' },
      { task: 't-home', path: '/' }
    ];

    expect(checkedAfter(tasks, asked, 't-card', '/collections/laptops')).toEqual(['t-collection']);
    expect(checkedAfter(tasks, asked, 't-collection', '/collections/laptops')).toEqual([]);
  });

  it('says which tasks touch the same file outside their own, unless one waits for the other', async () => {
    const plan = benchPlan();
    plan.tasks[0].touches = ['src/space/theme.ts'];
    plan.tasks[1].touches = ['src/space/theme.ts', 'src/space/pages/about.ts'];
    const read = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));

    expect(read.notices.some(notice => notice.includes('src/space/theme.ts is changed by "t-home" and "t-menu"'))).toBe(
      true
    );
    expect(
      read.notices.some(notice => notice.includes('"t-menu" touches src/space/pages/about.ts, which "t-about"'))
    ).toBe(true);

    expect(read.sharedReached).toContain('src/space/theme.ts');

    plan.tasks[1].dependsOn = ['t-home', 't-about'];
    const ordered = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));
    expect(ordered.notices.some(notice => notice.includes('is changed by'))).toBe(false);
    // Waiting for the holder, it finds the file free once the holder is done: nothing to propose.
    expect(ordered.notices.some(notice => notice.includes('which "t-about" holds'))).toBe(false);
  });

  it('sets a quality where the plan says none — what many build on high, a one-file few minutes light — and keeps one said', async () => {
    const plan = benchPlan();
    plan.tasks = [
      { ...plan.tasks[0], estimateMinutes: 30 },
      ...['t-menu', 't-book', 't-about'].map(id => ({
        ...(plan.tasks.find(task => task.id === id) ?? plan.tasks[0]),
        dependsOn: ['t-home']
      }))
    ];
    plan.tasks[3] = { ...plan.tasks[3], estimateMinutes: 10, quality: 'standard' as const };
    plan.tasks[1] = { ...plan.tasks[1], estimateMinutes: 5 };
    const read = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));
    const quality = Object.fromEntries(read.tasks.map(task => [task.id, task.quality]));

    expect(quality).toMatchObject({ 't-home': 'high', 't-menu': 'light', 't-about': 'standard' });
    expect(read.notices.find(notice => notice.startsWith('Quality where the plan said none'))).toContain(
      't-home high (3 tasks build on it)'
    );
  });

  it('hands an agent started at a level tasks of it or below, and says what waits above it', async () => {
    const plan = benchPlan();
    plan.tasks = plan.tasks.map(task => ({
      ...task,
      dependsOn: [],
      quality: task.id === 't-home' ? ('high' as const) : ('standard' as const)
    }));
    await openWith(lead(), await bench.writePlan({ ...plan, designReview: false }), 4);
    const standard = bench.agent('agent-1', { quality: 'standard' });
    const offered = new Set<string>();
    for (const id of ['t-menu', 't-book', 't-about']) {
      const next = await nextTask(standard, 'es-launch');
      offered.add(next.task?.id ?? '');
      await takeTask(bench.agent(`agent-${id}`), 'es-launch', next.task?.id ?? id);
    }

    expect(offered.has('t-home')).toBe(false);
    expect((await nextTask(standard, 'es-launch')).why).toContain(
      'above the standard you were started at: t-home (high)'
    );
    expect((await nextTask(bench.agent('agent-9', { quality: 'high' }), 'es-launch')).task?.id).toBe('t-home');
  });

  it('carries what the plan leaves out to the person and the report, and refuses a leftOut that is not lines', async () => {
    const plan = { ...benchPlan(), leftOut: ['The tier list: a second run'] };
    const read = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));
    expect(read.leftOut).toEqual(['The tier list: a second run']);
    expect(runPlanProblems({ ...benchPlan(), leftOut: 'the tier list' })).toContain(
      'leftOut: lines of what the run does not do, not "the tier list"'
    );
  });

  it('says a file other tasks import, and a task whose acceptance no command proves', async () => {
    const plan = benchPlan();
    plan.tasks.push({
      id: 't-theme',
      title: 'A warmer theme',
      files: ['src/space/theme.ts'],
      dependsOn: [],
      priority: 'low',
      estimateMinutes: 10,
      acceptance: [{ said: 'The theme authors', check: 'plitzi space author' }]
    });
    const read = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));

    expect(read.notices).toContainEqual(
      expect.stringContaining(
        'src/space/theme.ts (t-theme) is imported by the files of other tasks — src/space/pages/book.ts (t-book), src/space/pages/home/index.ts (t-home), src/space/pages/menu.ts (t-menu)'
      )
    );
    // Said once for every task with no check — t-theme has one.
    const unchecked = read.notices.filter(notice => notice.startsWith('No line of'));
    expect(unchecked).toHaveLength(1);
    expect(unchecked[0]).toContain('"t-home", "t-menu", "t-book", "t-about"');
    expect(unchecked[0]).not.toContain('t-theme');
  });

  // One designer beside four developers, and 21 tasks' UI went to the lead.
  it('says before the run that too few designers review the UI, and how many keep up', async () => {
    const teamOf = (designers: number) => ({
      version: 1 as const,
      agents: [
        { name: 'dev', roles: ['developer'], count: 4 },
        { name: 'design', roles: ['designer'], count: designers }
      ]
    });
    // Work enough for the team — three rounds of the bench's tasks — so that its size is not what is said.
    const big = {
      ...benchPlan(),
      tasks: [0, 1, 2].flatMap(round =>
        benchPlan().tasks.map(task => ({
          ...task,
          id: `${task.id}-${String(round)}`,
          files: task.files.map(file => file.replace('src/space/pages/', `src/space/pages/round-${String(round)}/`)),
          dependsOn: task.dependsOn.map(id => `${id}-${String(round)}`)
        }))
      )
    };
    const notices = async (designers: number) =>
      (await checkPlan(bench.root, big, await readOwnership(bench.root), teamOf(designers))).notices;

    expect(await notices(1)).toContainEqual(
      expect.stringContaining('12 tasks change what a visitor sees, and 1 designer reviews the UI of 4 developers')
    );
    expect((await notices(2)).some(notice => notice.includes('change what a visitor sees'))).toBe(false);

    // In a copy of a site each review measures every value — one designer for each developer.
    const copying = async (designers: number) =>
      (
        await checkPlan(
          bench.root,
          { ...big, reference: 'https://www.example.com' },
          await readOwnership(bench.root),
          teamOf(designers)
        )
      ).notices;
    expect(await copying(2)).toContainEqual(
      expect.stringContaining('one for every 1 in a copy of a site, each review measuring it against the original')
    );
    expect((await copying(4)).some(notice => notice.includes('change what a visitor sees'))).toBe(false);
  });

  // Three tasks of a few values for two developers and a designer — dev-2's 62k tokens on one task.
  it('says before the run that the team is too big for the work, rather than asking it for more designers', async () => {
    const team = {
      version: 1 as const,
      agents: [
        { name: 'dev', roles: ['developer'], count: 4 },
        { name: 'design', roles: ['designer'] }
      ]
    };
    const { notices } = await checkPlan(bench.root, benchPlan(), await readOwnership(bench.root), team);

    expect(notices).toContainEqual(expect.stringContaining('4 tasks for 5 agents: each agent starts by reading'));
    expect(notices.some(notice => notice.includes('change what a visitor sees'))).toBe(false);

    // A kanban keeps cards ahead of the team: the backlog's open items, those no task of the plan closes, are said.
    await addBacklogItem(lead(), { text: 'The footer wraps at 390', by: 'lead' });
    await addBacklogItem(lead(), { text: 'The hero is 4px low', by: 'lead' });
    const plan = benchPlan();
    plan.tasks[0] = { ...plan.tasks[0], closes: ['b-2'] };
    const stacked = (await checkPlan(bench.root, plan, await readOwnership(bench.root), team)).notices;
    expect(stacked).toContainEqual(
      expect.stringContaining('More cards keep the board ahead of the team — the backlog holds b-1')
    );
  });

  it('expands a root with what it owns, says what is shared, and estimates it', async () => {
    const checked = await checkPlan(bench.root, benchPlan(), await readOwnership(bench.root), teamFor(benchPlan(), 4));

    expect(checked.tasks.find(task => task.id === 't-home')?.files).toEqual([
      'src/space/pages/home/hero.ts',
      'src/space/pages/home/index.ts'
    ]);
    expect(checked.shared.map(shared => shared.file)).toEqual([
      'src/space/index.ts',
      'src/space/theme.ts',
      'src/space/tokens.ts'
    ]);
    expect(checked.estimate).toMatchObject({
      tasks: 4,
      totalMinutes: 70,
      criticalPathMinutes: 40,
      needsConfirmation: false
    });
  });

  // The product page's gallery and buying box, modules only it imports, could not be two tasks beside it.
  it('gives a module only a page imports to the task that names it, not to the page’s', async () => {
    const plan = benchPlan();
    plan.tasks[1].files = ['src/space/pages/home/hero.ts'];
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4));

    expect(checked.tasks.find(task => task.id === 't-home')?.files).toEqual(['src/space/pages/home/index.ts']);
    expect(checked.tasks.find(task => task.id === 't-menu')?.files).toEqual(['src/space/pages/home/hero.ts']);
  });

  it('expands a plugin’s folder named with or without its slash, and refuses a plain folder', async () => {
    const plan = benchPlan();
    plan.tasks[3].files = ['src/plugins/Badge'];
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4));

    expect(checked.tasks[3].files).toEqual(['src/plugins/Badge/declaration.ts', 'src/plugins/Badge/index.ts']);
    plan.tasks[3].files = ['src/space/pages/home'];
    const refused = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4)).catch(
      (error: unknown) => error
    );
    expect((refused as { problems: string[] }).problems.join('\n')).toContain('src/space/pages/home is a folder');
  });

  it('refuses, every reason at once, a repeated file, a cycle, an unknown task, credentials and what is not source', async () => {
    const plan = benchPlan();
    // Named by both: one file, two tasks.
    plan.tasks[0].files = [...plan.tasks[0].files, 'src/space/pages/home/hero.ts'];
    plan.tasks[1].files = ['src/space/pages/home/hero.ts', '.env', 'node_modules/x.js'];
    plan.tasks[0].dependsOn = ['t-book'];
    plan.tasks[3].dependsOn = ['t-nowhere'];

    const refused = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4)).catch(
      (error: unknown) => error
    );

    expect(refused).toBeInstanceOf(Error);
    const problems = (refused as { problems: string[] }).problems;
    expect(problems.some(problem => problem.includes('hero.ts is in "t-home" and "t-menu"'))).toBe(true);
    expect(problems.some(problem => problem.includes('cycle: t-home → t-book → t-home'))).toBe(true);
    expect(problems.some(problem => problem.includes('"t-nowhere", which is not in the plan'))).toBe(true);
    expect(problems.some(problem => problem.includes('.env holds credentials'))).toBe(true);
    expect(problems.some(problem => problem.includes('node_modules/x.js is not the project'))).toBe(true);
  });

  it('refuses an acceptance it could not hold: a line saying nothing, an empty check, .env read, nothing to serve', async () => {
    const plan = benchPlan();
    plan.tasks[0].acceptance = [
      ' ',
      { said: 'The hero says hello', check: '' },
      { said: 'The key is set', check: 'grep PLITZI_SECRET .env' },
      { said: 'The page answers', check: 'curl -sf "$PLITZI_URL/"' },
      { said: 'The example lists the key', check: 'grep PLITZI_SECRET .env.example' }
    ];

    const refused = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4)).catch(
      (error: unknown) => error
    );
    const problems = (refused as { problems: string[] }).problems.join('\n');

    expect(problems).toContain('a line of its acceptance says nothing');
    expect(problems).toContain('"The hero says hello" has an empty check');
    expect(problems).toContain('the check of "The key is set" reads .env');
    expect(problems).toContain(
      'names the copy served ($PLITZI_URL, $PLITZI_PORT), and the project has no start script'
    );
    expect(problems).not.toContain('The example lists the key');
  });

  it('finds a cycle and names it', () => {
    expect(
      findCycle([
        { id: 'a', dependsOn: ['b'] },
        { id: 'b', dependsOn: ['a'] }
      ])
    ).toEqual(['a', 'b', 'a']);
    expect(findCycle([{ id: 'a', dependsOn: [] }])).toBeUndefined();
  });

  it('asks a person above the threshold, and a run does not open without one', async () => {
    const plan = benchPlan('big');
    plan.tasks.forEach(task => {
      task.estimateMinutes = 200;
    });
    const file = await bench.writePlan(plan);

    expect((await refusal(openWith(lead(), file, 4))).code).toBe('person-only');
    await openWith(bench.person(true), file, 4);
    expect((await loadRun(lead(), 'big')).record.confirmed).toBeDefined();
  });
});

describe('opening a run', () => {
  it('backs up every file it will touch, under tmp/, and makes the independent tasks ready', async () => {
    const runId = await open();
    const loaded = await loadRun(lead(), runId);
    const base = JSON.parse(await fs.readFile(runPaths(bench.root, runId).base, 'utf-8')) as { files: object };

    expect(runPaths(bench.root, runId).dir.startsWith(path.join(bench.root, RUNS_DIR))).toBe(true);
    expect(Object.keys(base.files)).toContain('src/space/theme.ts');
    expect(Object.keys(base.files)).toContain('src/space/pages/home/hero.ts');
    expect((await nextTask(lead(), runId)).ready).toEqual(['t-home', 't-menu', 't-about']);
    expect(loaded.tasks).toHaveLength(4);
  });
});

describe('how many agents at once', () => {
  it('lets as many tasks be worked at once as the run allows, and the next when one finishes', async () => {
    await open(benchPlan(), { agents: 2 });
    const home = await take('agent-1', 't-home');
    await take('agent-2', 't-menu');

    const refused = await refusal(takeTask(bench.agent('agent-3'), 'es-launch', 't-about'));
    expect(refused.code).toBe('agent-limit');
    expect(refused.message).toContain('2 of the 2 agents');

    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'Hola' };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    await take('agent-3', 't-about');
    const third = benchPlan('third');
    await abortRun(bench.person(true), 'es-launch');
    await open(third, { agents: 1 });
    const results = await Promise.allSettled([
      takeTask(bench.agent('agent-1'), 'third', 't-home'),
      takeTask(bench.agent('agent-2'), 'third', 't-menu')
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find(result => result.status === 'rejected');
    expect(lost && isRunRefusal(lost.reason) ? lost.reason.code : undefined).toBe('agent-limit');
  });

  it('above 5 agents a person confirms', async () => {
    const file = await bench.writePlan(benchPlan());
    expect((await refusal(openWith(lead(), file, 6))).code).toBe('person-only');
  });
});

// Carlos: the lead sees lint and types clean before the agents begin — a failure there meets every task's check.
describe('a run opened on a project that fails its own checks', () => {
  it('is refused, naming the checks — and opened despite them only said why, told to every task', async () => {
    await bench.write('src/space/pages/broken.ts', 'BROKEN\n');
    const file = await bench.writePlan({ ...benchPlan(), designReview: false });
    await bench.writeTeam(teamFor(benchPlan(), 2));
    const refused = await refusal(openRun(lead(), file));
    expect(refused.code).toBe('checks-failed');
    expect(refused.message).toContain('The project fails its own checks before the run (author)');

    await openRun(lead(), file, { despiteChecks: 'a page the person is still writing' });
    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(each => each.to === EVERYONE);
    expect(told?.text).toContain(
      'The project failed author before the run, and it was opened despite it: a page the person is still writing'
    );
  });
});
