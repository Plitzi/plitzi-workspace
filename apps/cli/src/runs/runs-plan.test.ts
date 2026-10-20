import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { abortRun } from './merge';
import { readOwnership } from './ownership';
import { RUNS_DIR, runPaths } from './paths';
import { checkPlan, findCycle } from './plan';
import { isRunRefusal } from './refusal';
import { loadRun } from './run';
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
