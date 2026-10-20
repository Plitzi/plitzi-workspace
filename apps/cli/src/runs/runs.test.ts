import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExclusive, writeAtomic } from './files';
import { waitForLead } from './leadWatch';
import { abortRun, continueRun, finishRun, resolveFile, restoreFile, showVersion } from './merge';
import { readOwnership } from './ownership';
import { BACKUPS_DIR, REPORTS_DIR, RUNS_DIR, runPaths, taskPaths } from './paths';
import { checkPlan, findCycle } from './plan';
import { startTaskPreview } from './preview';
import { syncPreview } from './preview';
import { answerProposal, proposeChange } from './proposals';
import { isRunRefusal } from './refusal';
import { buildReport, writeSummary } from './report';
import { attachRun, checkPlanFile, loadRun, openRun, pruneRuns, purgeRun, releaseRun, resumeRun, stopRun } from './run';
import { showTask } from './show';
import { askLead, messageTasks, readInbox, tellLead } from './talk';
import {
  blockTask,
  canWrite,
  claimFile,
  completeTask,
  discardFile,
  followNext,
  followWait,
  nextTask,
  reassignTask,
  releaseFile,
  reportProgress,
  requestShared,
  revertTask,
  reviewTask,
  takeTask,
  taskContext,
  unblockTask,
  waitForFile
} from './tasks';
import { DEFAULTS } from './taskStore';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';

import type { RunPlan } from './model';
import type { RefusalCode } from './refusal';
import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const refusal = async (work: Promise<unknown>): Promise<{ code: RefusalCode; message: string; detail: unknown }> => {
  try {
    await work;
  } catch (error) {
    if (isRunRefusal(error)) {
      return { code: error.code, message: error.message, detail: error.detail };
    }

    throw error;
  }

  throw new Error('It was not refused');
};

const lead = (): RunContext => bench.agent('lead');

/**
 * Opens the bench's plan as the lead — and writes the summary it closes the run with, which the final merge asks
 * for, unless a test is about that.
 */
const open = async (plan = benchPlan(), { summary = true, agents = 4 } = {}): Promise<string> => {
  await openRun(lead(), await bench.writePlan(plan), agents);
  if (summary) {
    await bench.write('summary.md', '# What the run did\n\nTranslated the pages; nothing left.\n');
    await writeSummary(lead(), plan.runId, 'summary.md');
  }

  return plan.runId;
};

/** A scripted agent takes a task: its context carries the token from then on. */
const take = async (name: string, taskId: string, runId = 'es-launch') => {
  const taken = await takeTask(bench.agent(name), runId, taskId);

  return { ...taken, ctx: bench.agent(name, { token: taken.token }) };
};

/** Takes, writes, completes and approves a task: the whole round a subagent and its reviewer make. */
const doTask = async (name: string, taskId: string, file: string, text: string, runId = 'es-launch') => {
  const held = await take(name, taskId, runId);
  await writeInCopy(held.work, file, text);
  await completeTask(held.ctx, runId, taskId);

  return reviewTask(lead(), runId, taskId, 'approve', []);
};

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
    const read = await checkPlan(bench.root, plan, await readOwnership(bench.root), 3);

    expect(read.notices.some(notice => notice.includes('src/space/theme.ts is changed by "t-home" and "t-menu"'))).toBe(
      true
    );
    expect(
      read.notices.some(notice => notice.includes('"t-menu" touches src/space/pages/about.ts, which "t-about"'))
    ).toBe(true);

    expect(read.sharedReached).toContain('src/space/theme.ts');

    plan.tasks[1].dependsOn = ['t-home'];
    const ordered = await checkPlan(bench.root, plan, await readOwnership(bench.root), 3);
    expect(ordered.notices.some(notice => notice.includes('is changed by'))).toBe(false);
  });

  it('expands a root with what it owns, says what is shared, and estimates it', async () => {
    const checked = await checkPlan(bench.root, benchPlan(), await readOwnership(bench.root), 4);

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
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), 4);

    expect(checked.tasks[3].files).toEqual(['src/plugins/Badge/declaration.ts', 'src/plugins/Badge/index.ts']);
    plan.tasks[3].files = ['src/space/pages/home'];
    const refused = await checkPlan(bench.root, plan, await readOwnership(bench.root), 4).catch(
      (error: unknown) => error
    );
    expect((refused as { problems: string[] }).problems.join('\n')).toContain('src/space/pages/home is a folder');
  });

  it('refuses, every reason at once, a repeated file, a cycle, an unknown task, credentials and what is not source', async () => {
    const plan = benchPlan();
    plan.tasks[1].files = ['src/space/pages/home/hero.ts', '.env', 'node_modules/x.js'];
    plan.tasks[0].dependsOn = ['t-book'];
    plan.tasks[3].dependsOn = ['t-nowhere'];

    const refused = await checkPlan(bench.root, plan, await readOwnership(bench.root), 4).catch(
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

    expect((await refusal(openRun(lead(), file, 4))).code).toBe('person-only');
    await openRun(bench.person(true), file, 4);
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

describe('taking a task', () => {
  it('locks its files and copies the project — never its credentials, never node_modules', async () => {
    await bench.write('node_modules/pkg/index.js', 'module.exports = 1;\n');
    const runId = await open();
    const held = await take('agent-1', 't-home');

    expect(await readInCopy(held.work, 'src/space/pages/home/hero.ts')).toContain('Welcome');
    expect(await readInCopy(held.work, '.env')).toBeUndefined();
    expect(await readInCopy(held.work, '.env.example')).toContain('PLITZI_SECRET=');
    expect(await readInCopy(held.work, 'node_modules/pkg/index.js')).toBeUndefined();
    expect(await readInCopy(held.work, 'public/logo.png')).toBeUndefined();
    expect(held.token.startsWith(`${runId}.t-home.`)).toBe(true);
    expect(
      await fs.readFile(
        path.join(taskPaths(runPaths(bench.root, runId), 't-home').locks, 'src/space/pages/home/hero.ts.lock'),
        'utf-8'
      )
    ).toContain('"taskId": "t-home"');
    expect(await canWrite(bench.agent('other'), 'src/space/pages/home/hero.ts')).toMatchObject({ ok: false });
    expect(await canWrite(bench.agent('agent-1'), 'src/space/pages/home/hero.ts', 't-home')).toMatchObject({
      ok: true
    });
  });

  it('of two agents taking one task at once, one wins and the other is told who holds it', async () => {
    await open();
    const results = await Promise.allSettled([
      takeTask(bench.agent('agent-1'), 'es-launch', 't-home'),
      takeTask(bench.agent('agent-2'), 'es-launch', 't-home')
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find(result => result.status === 'rejected');
    expect(lost && isRunRefusal(lost.reason) ? lost.reason.code : undefined).toBe('claimed');
  });

  it('eight agents on eight tasks at once: none writes another’s file, nothing is lost', async () => {
    const files: Record<string, string> = { 'package.json': '{ "name": "eight", "type": "module" }\n' };
    const imports: string[] = [];
    for (let n = 1; n <= 8; n += 1) {
      files[`src/space/pages/p${String(n)}.ts`] = `export const p${String(n)} = 'page ${String(n)}';\n`;
      imports.push(`import { p${String(n)} } from './pages/p${String(n)}.ts';`);
    }

    files['src/space/index.ts'] = `${imports.join('\n')}\n\nexport const space = {};\n`;
    await bench.cleanup();
    bench = await makeBench(files);
    const plan = benchPlan('eight');
    plan.tasks = Array.from({ length: 8 }, (_, index) => ({
      id: `t${String(index + 1)}`,
      title: `Page ${String(index + 1)}`,
      files: [`src/space/pages/p${String(index + 1)}.ts`],
      dependsOn: [],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: []
    }));
    await openRun(bench.person(true), await bench.writePlan(plan), 8);
    await bench.write('summary.md', 'Eight pages, eight agents.\n');
    await writeSummary(lead(), 'eight', 'summary.md');
    await Promise.all(
      plan.tasks.map(async (task, index) => {
        const held = await take(`agent-${String(index + 1)}`, task.id, 'eight');
        await writeInCopy(
          held.work,
          task.files[0],
          `export const p${String(index + 1)} = 'página ${String(index + 1)}';\n`
        );
        await completeTask(held.ctx, 'eight', task.id);
      })
    );
    for (const task of plan.tasks) {
      await reviewTask(lead(), 'eight', task.id, 'approve', []);
    }

    await finishRun(bench.person(true), 'eight', { apply: true, leavePending: false });
    for (let n = 1; n <= 8; n += 1) {
      expect(await bench.read(`src/space/pages/p${String(n)}.ts`)).toContain(`página ${String(n)}`);
    }
  });
});

describe('writing only what is one’s own', () => {
  it('refuses a completion that changed another task’s file, naming it — and discarding it puts it right', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await take('agent-2', 't-menu');
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'Bienvenido' };
`
    );
    await writeInCopy(home.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');

    const refused = await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect(refused.code).toBe('claimed');
    expect(refused.message).toContain('src/space/pages/menu.ts (task "t-menu"');

    await discardFile(home.ctx, 'es-launch', 't-home', 'src/space/pages/menu.ts');
    const completed = await completeTask(home.ctx, 'es-launch', 't-home');
    expect(completed.changed).toEqual(['src/space/pages/home/hero.ts']);
  });

  it('refuses a completion whose checks fail in the copy, and the project is never touched', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = BROKEN;\n');

    expect((await refusal(completeTask(home.ctx, 'es-launch', 't-home'))).code).toBe('checks-failed');
    expect(await bench.read('src/space/pages/home/hero.ts')).toContain('Welcome');
  });

  it('refuses a token that is not the task’s any more: reassigned', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await reassignTask(lead(), 'es-launch', 't-home');

    expect((await refusal(completeTask(home.ctx, 'es-launch', 't-home'))).code).toBe('reassigned');
  });

  it('refuses a person’s action from a task’s token, and from an agent’s shell', async () => {
    await open();
    const home = await take('agent-1', 't-home');

    expect((await refusal(finishRun(home.ctx, 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'person-only'
    );
    expect((await refusal(stopRun(lead(), 'es-launch', true))).code).toBe('person-only');
    expect((await refusal(reviewTask(home.ctx, 'es-launch', 't-home', 'approve', []))).code).toBe('person-only');
  });
});

describe('dependencies and review', () => {
  it('starts the dependent task by itself when what it depends on is approved; the independent runs alongside', async () => {
    await open();
    expect((await nextTask(lead(), 'es-launch')).ready).not.toContain('t-book');
    await doTask(
      'agent-1',
      't-home',
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'Bienvenido' };
`
    );
    const approved = await doTask(
      'agent-2',
      't-menu',
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { id: 'menu', title: 'Carta', theme };
`
    );

    expect(approved.ready).toEqual(['t-book']);
    expect((await nextTask(lead(), 'es-launch')).ready).toEqual(['t-book', 't-about']);
  });

  it('sends changes back to the same task, and after three rounds to a person', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    for (let round = 1; round <= 3; round += 1) {
      await writeInCopy(
        home.work,
        'src/space/pages/home/hero.ts',
        `export const hero = { text: 'v${String(round)}' };\n`
      );
      await completeTask(home.ctx, 'es-launch', 't-home');
      const reviewed = await reviewTask(lead(), 'es-launch', 't-home', 'changes', [
        { note: 'shorter', element: 'hero-title' }
      ]);
      expect(reviewed.toPerson).toBe(round === 3);
    }

    const view = await viewRun(lead(), 'es-launch');
    expect(view.tasks.find(task => task.id === 't-home')?.status).toBe('blocked');
    expect(view.attention.some(item => item.kind === 'person')).toBe(true);

    // The person looks at it and takes it as it is: a person's, confirmed.
    expect((await refusal(reviewTask(lead(), 'es-launch', 't-home', 'approve', []))).code).toBe('person-only');
    expect((await reviewTask(bench.person(true), 'es-launch', 't-home', 'approve', [])).verdict).toBe('approve');
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.status).toBe('done');
  });
});

describe('shared files: turns, waits and requests', () => {
  it('takes a shared file by turns; the next waits, and gets it with the approved version', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    expect(await claimFile(home.ctx, 'es-launch', 't-home', 'src/space/theme.ts')).toMatchObject({ granted: true });

    const refused = await refusal(claimFile(menu.ctx, 'es-launch', 't-menu', 'src/space/theme.ts'));
    expect(refused.code).toBe('claimed');
    expect(refused.detail).toMatchObject({ holder: 't-home', turn: 'wait' });
    await waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/theme.ts');

    await writeInCopy(
      home.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink, lang: 'es' } };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    const approved = await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);

    expect(approved.granted).toEqual(['src/space/theme.ts → t-menu']);
    expect(await readInCopy(menu.work, 'src/space/theme.ts')).toMatch(/lang: .es./);
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-menu')?.status).toBe('in-progress');
  });

  it('refuses the wait that would close a cycle, naming it', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await waitForFile(home.ctx, 'es-launch', 't-home', 'src/space/pages/menu.ts');

    const refused = await refusal(waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/pages/home/hero.ts'));
    expect(refused.code).toBe('invalid');
    expect(refused.message).toContain('t-menu waits for t-home waits for t-menu');
  });

  it('the first to complete takes a free shared file by turns; the same lines changed by another make an integration task', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await requestShared(home.ctx, 'es-launch', 't-home', 'src/space/theme.ts', {
      summary: 'A badge for the language',
      usedIn: ['src/space/pages/home/index.ts'],
      blocking: false
    });
    await writeInCopy(
      home.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, badge: {} };
`
    );
    await writeInCopy(
      menu.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, price: {} };
`
    );
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { id: 'menu', title: 'Carta', theme };
`
    );

    expect((await completeTask(home.ctx, 'es-launch', 't-home')).claimed).toEqual(['src/space/theme.ts']);
    expect((await completeTask(menu.ctx, 'es-launch', 't-menu')).requests.map(each => each.file)).toEqual([
      'src/space/theme.ts'
    ]);
    expect((await reviewTask(lead(), 'es-launch', 't-home', 'approve', [])).integrations).toEqual([]);
    const approved = await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    expect(approved.integrations).toEqual(['integrate-src-space-theme-ts']);
    const refused = await refusal(finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true }));
    expect(refused.message).toContain('Requests on shared files are not integrated');

    const integrator = await take('agent-3', 'integrate-src-space-theme-ts');
    const context = await taskContext(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts');
    expect(context.requests.map(each => each.task)).toEqual(['t-menu']);
    expect(context.requests[0].diff).toContain('+export const theme = { card: { color: tokens.ink }, price: {} };');
    await writeInCopy(
      integrator.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, badge: {}, price: {} };
`
    );
    await completeTask(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts');
    await reviewTask(lead(), 'es-launch', 'integrate-src-space-theme-ts', 'approve', []);

    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/menu.ts', 'src/space/theme.ts']);
  });

  it('a shared file waiting for its integration stays shared: taken by turns meanwhile, and one integration a file', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    for (const [held, key] of [
      [home, 'badge'],
      [menu, 'price']
    ] as const) {
      await writeInCopy(
        held.work,
        'src/space/theme.ts',
        `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, ${key}: {} };
`
      );
      await completeTask(held.ctx, 'es-launch', held === home ? 't-home' : 't-menu');
    }

    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    expect((await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).integrations).toEqual([
      'integrate-src-space-theme-ts'
    ]);

    const about = await take('agent-3', 't-about');
    const theme = (await readInCopy(about.work, 'src/space/theme.ts')) ?? '';
    await writeInCopy(about.work, 'src/space/theme.ts', `${theme}export const aboutTone = 'warm';\n`);
    expect((await completeTask(about.ctx, 'es-launch', 't-about')).claimed).toEqual(['src/space/theme.ts']);
    await reviewTask(lead(), 'es-launch', 't-about', 'approve', []);

    const book = await take('agent-4', 't-book');
    const asked = await requestShared(book.ctx, 'es-launch', 't-book', 'src/space/theme.ts', {
      summary: 'A card for the booking form',
      usedIn: [],
      blocking: true
    });
    expect(asked.integration).toBe('integrate-src-space-theme-ts');
    expect(asked.request.wanted).toBe(asked.request.base);
    const integrator = await take('agent-5', 'integrate-src-space-theme-ts');
    const context = await taskContext(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts');
    expect(context.requests.map(each => each.task)).toEqual(['t-menu', 't-book']);
    expect(await readInCopy(integrator.work, 'src/space/theme.ts')).toMatch(/aboutTone = .warm./);
  });

  it('a file no task at work holds — a done task’s, or in no task of the plan — is taken by turns at complete', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = ${JSON.stringify({ id: 'about', title: 'Sobre' })};\n`
    );
    const home = await take('agent-2', 't-home');
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(
      home.work,
      'src/space/pages/about.ts',
      `export const about = ${JSON.stringify({ id: 'about', title: 'Nosotros' })};\n`
    );
    await writeInCopy(home.work, 'src/data/menu.json', `${JSON.stringify({ items: ['paella'] })}\n`);
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');

    expect((await completeTask(home.ctx, 'es-launch', 't-home')).claimed.sort()).toEqual([
      'src/data/menu.json',
      'src/space/pages/about.ts'
    ]);
    await writeInCopy(menu.work, 'src/data/menu.json', `${JSON.stringify({ items: ['tortilla'] })}\n`);
    await writeInCopy(menu.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: 1 };\n');
    const refused = await refusal(completeTask(menu.ctx, 'es-launch', 't-menu'));
    expect(refused.message).toContain('src/space/pages/home/hero.ts (task "t-home"');
  });

  it('a task reassigned lets go of what it held by turns: the request waiting on it is merged then', async () => {
    await open();
    const ghost = await take('agent-ghost', 't-home');
    await claimFile(ghost.ctx, 'es-launch', 't-home', 'src/space/theme.ts');
    const menu = await take('agent-2', 't-menu');
    const theme = (await readInCopy(menu.work, 'src/space/theme.ts')) ?? '';
    await writeInCopy(menu.work, 'src/space/theme.ts', `${theme}export const price = {};\n`);
    expect((await completeTask(menu.ctx, 'es-launch', 't-menu')).requests.map(each => each.file)).toEqual([
      'src/space/theme.ts'
    ]);
    await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    const cut = await reassignTask(lead(), 'es-launch', 't-home');
    expect(cut).toMatchObject({ released: ['src/space/theme.ts'], settled: ['t-menu/src-space-theme-ts'] });
    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toContain('src/space/theme.ts');
  });

  it('a blocking request makes its integration task at once, and the task waits only for it', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const asked = await requestShared(home.ctx, 'es-launch', 't-home', 'src/space/tokens.ts', {
      summary: 'A token for the accent, which does not exist yet',
      usedIn: [],
      blocking: true
    });

    expect(asked.integration).toBe('integrate-src-space-tokens-ts');
    const integrator = await take('agent-2', 'integrate-src-space-tokens-ts');
    await writeInCopy(
      integrator.work,
      'src/space/tokens.ts',
      `export const tokens = { ink: '#111', accent: '#c60' };
`
    );
    await completeTask(integrator.ctx, 'es-launch', 'integrate-src-space-tokens-ts');
    const approved = await reviewTask(lead(), 'es-launch', 'integrate-src-space-tokens-ts', 'approve', []);

    expect(approved.granted).toEqual(['src/space/tokens.ts → t-home']);
    expect(await readInCopy(home.work, 'src/space/tokens.ts')).toContain('accent');
  });
});

describe('the final merge', () => {
  it('shows the whole run as a dry run — changing nothing — and only a person writes it', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { id: 'about', title: 'Sobre nosotros' };
`
    );
    const before = await bench.read('src/space/pages/about.ts');

    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/about.ts']);
    expect(await bench.read('src/space/pages/about.ts')).toBe(before);
    expect((await refusal(finishRun(bench.person(false), 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'person-only'
    );

    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre nosotros');
    // Its work is in the project: the run is gone, backups and all, and nothing is left for anyone to clean up.
    expect(done.backup).toBeUndefined();
    expect(await fs.readdir(path.join(bench.root, RUNS_DIR))).toEqual([]);
    expect(await fs.stat(path.join(bench.root, BACKUPS_DIR)).catch(() => undefined)).toBeUndefined();
  });

  it('keeps the files it overwrote only when asked, as plain files a person copies back', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true, backup: true });

    expect(done.backup?.startsWith(path.join(bench.root, BACKUPS_DIR, 'es-launch-'))).toBe(true);
    expect(await fs.readFile(path.join(String(done.backup), 'files/src/space/pages/about.ts'), 'utf-8')).toMatch(
      /title: .About./
    );
    const manifest = JSON.parse(await fs.readFile(path.join(String(done.backup), 'manifest.json'), 'utf-8')) as {
      overwritten: string[];
      created: string[];
    };
    expect(manifest).toMatchObject({ overwritten: ['src/space/pages/about.ts'], created: [] });
    expect(await fs.readdir(path.join(bench.root, RUNS_DIR))).toEqual([]);
  });

  it('refuses the merge while tasks are in hand, and checks the whole result before writing', async () => {
    await open();
    await take('agent-1', 't-home');
    expect(
      (await refusal(finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true }))).message
    ).toContain('still in hand');
  });

  it('a person’s change on a file the run changed: reconciliation, nothing written; the person decides', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'About us — by a person' };
`
    );

    expect((await refusal(finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'reconciliation'
    );
    expect(await bench.read('src/space/pages/about.ts')).toContain('by a person');
    expect((await refusal(takeTask(bench.agent('agent-2'), 'es-launch', 't-menu'))).code).toBe('reconciliation');
    expect((await showVersion(bench.person(), 'es-launch', 'src/space/pages/about.ts', 'run'))?.toString()).toContain(
      'Sobre nosotros'
    );

    await resolveFile(bench.person(true), 'es-launch', 'src/space/pages/about.ts', 'project');
    await continueRun(bench.person(true), 'es-launch');
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(done.plan.apply).toEqual([]);
    expect(await bench.read('src/space/pages/about.ts')).toContain('by a person');
  });

  it('resolving with the run’s version writes it at the next finish', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'edited' };
`
    );
    await refusal(finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true }));
    await resolveFile(bench.person(true), 'es-launch', 'src/space/pages/about.ts', 'run');
    await continueRun(bench.person(true), 'es-launch');
    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });

    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre nosotros');
  });

  it('aborting writes nothing, says what it discards, and leaves nothing behind', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    const aborted = await abortRun(bench.person(true), 'es-launch');

    expect(aborted.discarded).toEqual(['src/space/pages/about.ts']);
    expect(await bench.read('src/space/pages/about.ts')).toMatch(/title: .About./);
    expect(await fs.readdir(path.join(bench.root, RUNS_DIR))).toEqual([]);
  });
});

describe('undoing', () => {
  it('reverts one task in the run’s work, the others untouched', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    await doTask(
      'agent-2',
      't-menu',
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { title: 'Carta', theme };
`
    );
    const reverted = await revertTask(lead(), 'es-launch', 't-about');

    expect(reverted.reverted).toEqual(['src/space/pages/about.ts']);
    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/menu.ts']);
  });

  it('puts one file back from the run’s opening backup', async () => {
    await open();
    await bench.write('src/space/pages/about.ts', 'broken by accident\n');
    await restoreFile(bench.person(true), 'es-launch', 'src/space/pages/about.ts', 'base');

    expect(await bench.read('src/space/pages/about.ts')).toMatch(/title: .About./);
  });

  it('a merge cut half-way is undone from its own journal before the next one goes in', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    const paths = runPaths(bench.root, 'es-launch');
    const original = (await bench.read('src/space/tokens.ts')) ?? '';
    await bench.write('src/space/tokens.ts', 'half-written by a cut merge\n');
    const { digest } = await import('../commands/spaceOrigin');
    await fs.mkdir(path.join(paths.blobs), { recursive: true });
    await fs.writeFile(path.join(paths.blobs, digest(original)), original);
    await writeAtomic(
      path.join(paths.merges, 'merge_9.json'),
      JSON.stringify({
        id: 'merge_9',
        kind: 'finish',
        at: bench.now().toISOString(),
        complete: false,
        files: { 'src/space/tokens.ts': { before: digest(original), after: digest('half-written by a cut merge\n') } }
      })
    );

    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await bench.read('src/space/tokens.ts')).toBe(original);
    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre');
  });
});

describe('stopping, cuts and disconnects', () => {
  it('a stop lets the tasks in hand finish and starts none', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await stopRun(lead(), 'es-launch', false);

    expect((await refusal(takeTask(bench.agent('agent-2'), 'es-launch', 't-menu'))).code).toBe('stopping');
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'Hola' };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    await resumeRun(lead(), 'es-launch');
    expect((await nextTask(lead(), 'es-launch')).task?.id).toBe('t-menu');
  });

  it('a forced stop is a person’s: what is being written is cut, what is in review kept, no copy pulled away', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    const stopped = await stopRun(bench.person(true), 'es-launch', true);

    expect(stopped.cut).toEqual(['t-home']);
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-menu')?.status).toBe('in-review');
    // An agent mid-command in its copy keeps a folder to stand in: the copy is left, its token revoked.
    await expect(fs.stat(home.work)).resolves.toBeDefined();
    const refused = await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect(refused.code).toBe('forced-stop');
    expect(refused.message).toContain('those in review keep their work');
  });

  it('every sign of life says when the run is stopping, before a refusal does', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).run).toBeUndefined();
    await stopRun(lead(), 'es-launch', false);
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).run).toMatchObject({ status: 'stopping' });
  });

  it('a task whose agent lost its signal: told, then taken over from its last reviewed version', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'reviewed once' };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    await reviewTask(lead(), 'es-launch', 't-home', 'changes', [{ note: 'shorter' }]);
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'half written' };
`
    );

    bench.advance(DEFAULTS.noSignalMs + 60_000);
    const view = await viewRun(lead(), 'es-launch');
    expect(view.attention.some(item => item.kind === 'no-signal' && item.task === 't-home')).toBe(true);
    expect((await refusal(takeTask(bench.agent('agent-2'), 'es-launch', 't-home'))).code).toBe('claimed');

    bench.advance(DEFAULTS.lockAfterSignalMs);
    const replaced = await take('agent-2', 't-home');
    expect(replaced.replaced).toBe('agent-1');
    expect(replaced.resumedFrom).toBe(1);
    expect(await readInCopy(replaced.work, 'src/space/pages/home/hero.ts')).toContain('reviewed once');
    expect((await refusal(reportProgress(home.ctx, 'es-launch', 't-home', { step: 'back' }))).code).toBe('reassigned');
  });

  it('a heartbeat keeps a long task alive and its locks held', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    for (let minute = 0; minute < 40; minute += 2) {
      bench.advance(2 * 60_000);
      await reportProgress(home.ctx, 'es-launch', 't-home', { fraction: minute / 40 });
    }

    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'no-signal')).toBe(false);
    expect(await canWrite(bench.agent('other'), 'src/space/pages/home/hero.ts')).toMatchObject({ ok: false });
  });

  it('the brake stops a run that keeps failing', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'BROKEN\n');
    for (let attempt = 0; attempt <= DEFAULTS.brakeFailures; attempt += 1) {
      await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    }

    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('stopping');
  });
});

describe('versions, machines and caches', () => {
  it('refuses every command when the Plitzi version changed under the run; a person re-pins it by attaching', async () => {
    await open();
    await take('agent-1', 't-home');
    const upgraded = bench.agent('agent-2', { cli: '0.0.1-bench' });

    expect((await refusal(nextTask(upgraded, 'es-launch'))).code).toBe('version-mismatch');
    expect((await refusal(attachRun(upgraded, 'es-launch', false))).code).toBe('person-only');
    const attached = await attachRun({ ...bench.person(true), cli: '0.0.1-bench' }, 'es-launch', false);
    expect(attached).toMatchObject({ repinned: true, cut: ['t-home'] });
    expect((await nextTask(upgraded, 'es-launch')).ready).toContain('t-home');
  });

  it('is active on one machine: another attaches once it is released, or a person takes it over', async () => {
    await open();
    const elsewhere = bench.agent('coordinator-2', { machine: 'laptop' });

    expect((await refusal(nextTask(elsewhere, 'es-launch'))).code).toBe('other-machine');
    expect((await refusal(attachRun(elsewhere, 'es-launch', false))).code).toBe('other-machine');
    await releaseRun(lead(), 'es-launch');
    await attachRun(elsewhere, 'es-launch', false);
    expect((await nextTask(elsewhere, 'es-launch')).ready.length).toBeGreaterThan(0);
  });

  it('prunes the caches of a run idle for 8 hours — never what undoes it — and the run resumes from its essentials', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    await take('agent-2', 't-home');
    bench.advance(DEFAULTS.cacheIdleMs + 60_000);
    const pruned = await pruneRuns(lead());

    expect(pruned.map(each => each.run)).toEqual(['es-launch']);
    expect((await attachRun(lead(), 'es-launch', false)).cut).toEqual(['t-home']);
    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/about.ts']);
  });

  it('one plan and one run at a time: a second is refused, whatever files it names', async () => {
    await open();
    const second = benchPlan('second');
    second.tasks = [{ ...second.tasks[3], files: ['src/data/menu.json'] }];
    const file = await bench.writePlan(second);

    expect((await refusal(checkPlanFile(lead(), file, 1))).code).toBe('another-run');
    const refused = await refusal(openRun(lead(), file, 1));
    expect(refused.code).toBe('another-run');
    expect(refused.message).toContain('Run "es-launch" is going');
  });

  it('a run cut while it opened leaves a claim that is taken over once it is old', async () => {
    await fs.mkdir(path.join(bench.root, RUNS_DIR), { recursive: true });
    await fs.writeFile(
      path.join(bench.root, RUNS_DIR, 'active.json'),
      JSON.stringify({ runId: 'cut', since: bench.now().toISOString(), by: 'lead' })
    );
    const file = await bench.writePlan(benchPlan());

    expect((await refusal(openRun(lead(), file, 3))).message).toContain('"cut" is opening');
    bench.advance(3 * 60_000);
    await openRun(lead(), file, 3);
    expect((await loadRun(lead(), 'es-launch')).record.agents).toBe(3);
  });

  it('of two runs opening at once, one opens', async () => {
    const first = await bench.writePlan(benchPlan('first'));
    const second = await bench.writePlan(benchPlan('second'));
    const results = await Promise.allSettled([openRun(lead(), first, 4), openRun(lead(), second, 4)]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find(result => result.status === 'rejected');
    expect(lost && isRunRefusal(lost.reason) ? lost.reason.code : undefined).toBe('another-run');
  });

  it('a purge is a person’s and takes the whole folder', async () => {
    await open();
    expect((await refusal(purgeRun(lead(), 'es-launch'))).code).toBe('person-only');
    await purgeRun(bench.person(true), 'es-launch');
    expect(await fs.stat(runPaths(bench.root, 'es-launch').dir).catch(() => undefined)).toBeUndefined();
  });
});

describe('tasks agreeing with each other', () => {
  it('a task proposes, waits, gets a counter, agrees — and the other cannot go to review leaving it unanswered', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    const proposed = await proposeChange(home.ctx, 'es-launch', 't-home', 't-menu', {
      change: 'The menu links back to home with a `lang` param',
      about: 'src/space/pages/menu.ts',
      wait: true
    });
    expect(proposed.proposal.id).toBe('t-home-p1');
    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'proposal')).toBe(true);

    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      `export const menu = { title: 'Carta' };
`
    );
    const refused = await refusal(completeTask(menu.ctx, 'es-launch', 't-menu'));
    expect(refused.message).toContain('proposals to answer first: t-home-p1');

    const countered = await answerProposal(menu.ctx, 'es-launch', 't-home-p1', {
      verdict: 'counter',
      counter: 'A `lang` field in the shared tokens instead'
    });
    expect(countered.counter?.id).toBe('t-menu-p1');
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.status).toBe('in-progress');

    await answerProposal(home.ctx, 'es-launch', 't-menu-p1', { verdict: 'accept' });
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    const context = await taskContext(menu.ctx, 'es-launch', 't-menu');
    expect(context.proposals.agreements.map(each => each.id)).toEqual(['t-menu-p1']);
  });

  it('refuses a wait for an answer that would close a cycle, and a proposal to a task that is done', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await proposeChange(home.ctx, 'es-launch', 't-home', 't-menu', { change: 'x', wait: true });

    expect(
      (await refusal(proposeChange(menu.ctx, 'es-launch', 't-menu', 't-home', { change: 'y', wait: true }))).message
    ).toContain('cycle');
    await doTask(
      'agent-3',
      't-about',
      'src/space/pages/about.ts',
      `export const about = {};
`
    );
    expect(
      (await refusal(proposeChange(menu.ctx, 'es-launch', 't-menu', 't-about', { change: 'z', wait: false }))).message
    ).toContain('is done');
  });

  it('after three rounds of counters the lead decides; a rejection says why', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await proposeChange(home.ctx, 'es-launch', 't-home', 't-menu', { change: 'one', wait: false });
    await answerProposal(menu.ctx, 'es-launch', 't-home-p1', { verdict: 'counter', counter: 'two' });
    await answerProposal(home.ctx, 'es-launch', 't-menu-p1', { verdict: 'counter', counter: 'three' });

    expect(
      (await refusal(answerProposal(menu.ctx, 'es-launch', 't-home-p2', { verdict: 'counter', counter: 'four' })))
        .message
    ).toContain('the lead decides');
    expect((await refusal(answerProposal(lead(), 'es-launch', 't-home-p2', { verdict: 'reject' }))).message).toContain(
      'says why'
    );
    await answerProposal(lead(), 'es-launch', 't-home-p2', {
      verdict: 'reject',
      note: 'tokens stay as they are'
    });
  });
});

describe('before writing: the file as the agent found it', () => {
  it('refuses to approve over a change made in the project meanwhile; the lead overwrites it with a notice, and the other version is kept', async () => {
    await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(
      about.work,
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    await completeTask(about.ctx, 'es-launch', 't-about');
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'About — a person, meanwhile' };
`
    );

    const refused = await refusal(reviewTask(lead(), 'es-launch', 't-about', 'approve', []));
    expect(refused.code).toBe('conflict');
    expect(refused.message).toContain('changed in the project while task "t-about" worked on it');
    expect(refused.message).toContain('--overwrite');

    await reviewTask(lead(), 'es-launch', 't-about', 'approve', [], 'overwrite');
    const view = await viewRun(lead(), 'es-launch');
    expect(view.attention.some(item => item.kind === 'overwrite')).toBe(true);

    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(done.plan.overwrites.map(each => each.file)).toEqual(['src/space/pages/about.ts']);
    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre nosotros');
    expect(await fs.readFile(path.join(String(done.backup), 'files/src/space/pages/about.ts'), 'utf-8')).toContain(
      'a person, meanwhile'
    );
  });

  it('a change made in the project meanwhile that merges line by line is offered, and --merge keeps both', async () => {
    await open();
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    const about = await take('agent-1', 't-about');
    await writeInCopy(
      about.work,
      'src/space/pages/about.ts',
      'export const title = 2;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    await completeTask(about.ctx, 'es-launch', 't-about');
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 3;\n'
    );

    const refused = await refusal(reviewTask(lead(), 'es-launch', 't-about', 'approve', []));
    expect(refused.message).toContain('--merge');
    expect(refused.detail).toMatchObject({ decide: ['--merge', '--overwrite', '--changes'] });

    const approved = await reviewTask(lead(), 'es-launch', 't-about', 'approve', [], 'merge');
    expect(approved.joined).toEqual(['src/space/pages/about.ts']);
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(done.plan.overwrites).toEqual([]);
    expect(await bench.read('src/space/pages/about.ts')).toBe(
      'export const title = 2;\nexport const body = 1;\nexport const foot = 3;\n'
    );
  });

  it('a reconciliation whose two changes touch different lines is resolved with both', async () => {
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      'export const title = 2;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 3;\n'
    );
    await refusal(finishRun(lead(), 'es-launch', { apply: false, leavePending: true }));

    expect((await resolveFile(lead(), 'es-launch', 'src/space/pages/about.ts', 'merge')).resolved).toBe('merged');
    await continueRun(lead(), 'es-launch');
    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await bench.read('src/space/pages/about.ts')).toBe(
      'export const title = 2;\nexport const body = 1;\nexport const foot = 3;\n'
    );
  });

  it('the lead resolves a reconciliation too, and taking the run’s version leaves the notice', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'edited after approval' };
`
    );
    // The dry run already says it, before any check runs over a mix of the two that would never exist.
    expect((await refusal(finishRun(lead(), 'es-launch', { apply: false, leavePending: true }))).code).toBe(
      'reconciliation'
    );
    await resolveFile(lead(), 'es-launch', 'src/space/pages/about.ts', 'run');
    await continueRun(lead(), 'es-launch');

    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.overwrites).toMatchObject([{ file: 'src/space/pages/about.ts', by: 'lead' }]);
  });
});

describe('the run’s report', () => {
  it('the final merge waits for the lead’s summary', async () => {
    await open(benchPlan(), { summary: false });
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );

    const refused = await refusal(finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true }));
    expect(refused.message).toContain('has no report yet');
  });

  it('is left when the run ends: the summary, the problems, every task, and what was written', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'BROKEN\n');
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'Hola' };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });

    expect(done.report?.startsWith(path.join(bench.root, REPORTS_DIR, 'es-launch-'))).toBe(true);
    const report = await fs.readFile(String(done.report), 'utf-8');
    expect(report).toContain('Translated the pages; nothing left.');
    expect(report).toContain('The project’s checks failed 1 time(s)');
    expect(report).toContain('| t-home | developer | done | agent-1 |');
    expect(report).toContain('t-menu did not finish');
    expect(report).toContain('- src/space/pages/home/hero.ts');
  });

  it('is left when a person aborts it too', async () => {
    await open(benchPlan(), { summary: false });
    const aborted = await abortRun(bench.person(true), 'es-launch');

    expect(await fs.readFile(aborted.report, 'utf-8')).toContain('_None was written._');
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
    expect((await refusal(openRun(lead(), file, 6))).code).toBe('person-only');
  });
});

/** The plan of pet-friends' run (RFC 0028's first real one): a shell holding the entry, then pages that register in it. */
const shellPlan = (): RunPlan => ({
  version: 1,
  runId: 'shell-run',
  goal: 'A shell, then pages',
  tasks: [
    {
      id: 't-shell',
      title: 'The shell',
      files: ['src/space/index.ts', 'src/data/pets.json'],
      dependsOn: [],
      priority: 'critical',
      estimateMinutes: 10,
      acceptance: []
    },
    ...['a', 'b'].map(name => ({
      id: `t-${name}`,
      title: `Page ${name}`,
      files: [`src/space/pages/${name}.ts`],
      dependsOn: ['t-shell'],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: []
    }))
  ]
});

const register = (index: string, name: string): string =>
  index
    .replace(
      /^(import \{ about \} from .\.\/pages\/about\.ts.;)$/m,
      `$1\nimport { ${name} } from './pages/${name}.ts';`
    )
    .replace('pages: [home, menu, book, about]', `pages: [home, menu, book, about, ${name}]`);

describe('what pet-friends taught (RFC 0028’s first real run)', () => {
  it('a shared file in a done task’s plan goes to whoever completes first; the same line changed by both is integrated, its diff what was asked', async () => {
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [{ "id": "luna" }] }
`,
      'shell-run'
    );
    const outcomes = [];
    for (const name of ['a', 'b']) {
      const held = await take(`agent-${name}`, `t-${name}`, 'shell-run');
      await writeInCopy(
        held.work,
        `src/space/pages/${name}.ts`,
        `export const ${name} = { id: '${name}' };
`
      );
      await writeInCopy(
        held.work,
        'src/space/index.ts',
        register((await readInCopy(held.work, 'src/space/index.ts')) ?? '', name)
      );
      outcomes.push(await completeTask(held.ctx, 'shell-run', `t-${name}`));
    }

    expect(outcomes.map(each => [each.claimed, each.requests.map(request => request.file)])).toEqual([
      [['src/space/index.ts'], []],
      [[], ['src/space/index.ts']]
    ]);
    await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);
    const approved = await reviewTask(lead(), 'shell-run', 't-b', 'approve', []);
    expect(approved.integrations).toEqual(['integrate-src-space-index-ts']);

    const integrator = await take('agent-i', 'integrate-src-space-index-ts', 'shell-run');
    const context = await taskContext(integrator.ctx, 'shell-run', 'integrate-src-space-index-ts');
    expect(context.requests.map(each => each.task)).toEqual(['t-b']);
    expect(context.requests[0].diff).toMatch(/^\+import \{ b \} from .\.\/pages\/b\.ts.;$/m);
    expect(context.requests[0].diff).not.toMatch(/^-import/m);
  });

  it('a request on a file another task holds by turns waits for it, and goes in when that task lets go of it', async () => {
    await bench.write(
      'src/space/index.ts',
      `import { home } from './pages/home/index.ts';

export const space = {
  pages: [
    home
  ]
};
`
    );
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const a = await take('agent-a', 't-a', 'shell-run');
    const b = await take('agent-b', 't-b', 'shell-run');
    await claimFile(a.ctx, 'shell-run', 't-a', 'src/space/index.ts');
    for (const [task, name] of [
      [a, 'a'],
      [b, 'b']
    ] as const) {
      await writeInCopy(
        task.work,
        `src/space/pages/${name}.ts`,
        `export const ${name} = {};
`
      );
      const index = (await readInCopy(task.work, 'src/space/index.ts')) ?? '';
      await writeInCopy(
        task.work,
        'src/space/index.ts',
        index
          .replace(/(from .\.\/pages\/home\/index\.ts.;)/, `$1\nimport { ${name} } from './pages/${name}.ts';`)
          .replace('    home\n', `    home,\n    ${name}\n`)
      );
    }

    await completeTask(b.ctx, 'shell-run', 't-b');
    expect((await reviewTask(lead(), 'shell-run', 't-b', 'approve', [])).integrations).toEqual([]);
    await completeTask(a.ctx, 'shell-run', 't-a');
    const approved = await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);

    expect(approved.settled).toEqual(['t-b/src-space-index-ts']);
    const index = (await showVersion(bench.person(), 'shell-run', 'src/space/index.ts', 'run'))?.toString() ?? '';
    expect(index).toMatch(/import \{ a \}/);
    expect(index).toMatch(/import \{ b \}/);
  });

  it('pages registered on lines of their own go in as each task is approved: no integration at all', async () => {
    await bench.write(
      'src/space/index.ts',
      `import { home } from './pages/home/index.ts';

export const space = {
  pages: [
    home
  ]
};
`
    );
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const held = [];
    for (const name of ['a', 'b']) {
      const task = await take(`agent-${name}`, `t-${name}`, 'shell-run');
      await writeInCopy(
        task.work,
        `src/space/pages/${name}.ts`,
        `export const ${name} = {};
`
      );
      const index = (await readInCopy(task.work, 'src/space/index.ts')) ?? '';
      await writeInCopy(
        task.work,
        'src/space/index.ts',
        index
          .replace(/(from .\.\/pages\/home\/index\.ts.;)/, `$1\nimport { ${name} } from './pages/${name}.ts';`)
          .replace('    home\n', `    home,\n    ${name}\n`)
      );
      held.push(task);
    }

    for (const task of held) {
      await completeTask(task.ctx, 'shell-run', task.task.id);
    }

    await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);
    expect((await reviewTask(lead(), 'shell-run', 't-b', 'approve', [])).integrations).toEqual([]);
    const index = (await showVersion(bench.person(), 'shell-run', 'src/space/index.ts', 'run'))?.toString() ?? '';
    expect(index).toMatch(/import \{ a \}/);
    expect(index).toMatch(/import \{ b \}/);
  });

  it('a request on a file the task then held by turns is fulfilled when it is approved: no integration for it', async () => {
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const a = await take('agent-a', 't-a', 'shell-run');
    await requestShared(a.ctx, 'shell-run', 't-a', 'src/space/index.ts', {
      summary: 'register a',
      usedIn: [],
      blocking: false
    });
    await claimFile(a.ctx, 'shell-run', 't-a', 'src/space/index.ts');
    await writeInCopy(
      a.work,
      'src/space/pages/a.ts',
      `export const a = {};
`
    );
    await writeInCopy(
      a.work,
      'src/space/index.ts',
      register((await readInCopy(a.work, 'src/space/index.ts')) ?? '', 'a')
    );
    await completeTask(a.ctx, 'shell-run', 't-a');
    const approved = await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);

    expect(approved.integrations).toEqual([]);
    expect((await viewRun(lead(), 'shell-run')).attention.some(item => item.kind === 'request')).toBe(false);
  });

  it('a file handed on by turns arrives with what the run approved since the copy was made', async () => {
    await open(shellPlan());
    await doTask(
      'agent-0',
      't-shell',
      'src/data/pets.json',
      `{ "items": [] }
`,
      'shell-run'
    );
    const a = await take('agent-a', 't-a', 'shell-run');
    const b = await take('agent-b', 't-b', 'shell-run');
    await claimFile(a.ctx, 'shell-run', 't-a', 'src/space/index.ts');
    await waitForFile(b.ctx, 'shell-run', 't-b', 'src/space/index.ts');
    await writeInCopy(
      a.work,
      'src/space/pages/a.ts',
      `export const a = {};
`
    );
    await writeInCopy(
      a.work,
      'src/space/index.ts',
      register((await readInCopy(a.work, 'src/space/index.ts')) ?? '', 'a')
    );
    await completeTask(a.ctx, 'shell-run', 't-a');
    await reviewTask(lead(), 'shell-run', 't-a', 'approve', []);

    expect(await readInCopy(b.work, 'src/space/index.ts')).toMatch(/from .\.\/pages\/a\.ts./);
    expect(await readInCopy(b.work, 'src/space/pages/a.ts')).toContain('export const a');
    const followed = await followWait(b.ctx, 'shell-run', 't-b', { timeoutMs: 1000, everyMs: 10 });
    expect(followed.done).toBe(true);
    expect(followed.note).toContain('Brought into your copy, approved since it was made: src/space/pages/a.ts');
  });

  it('complete brings in what was approved meanwhile before its checks, and a folder’s .gitkeep is the task’s to remove', async () => {
    await bench.write('src/data/.gitkeep', '');
    await open(shellPlan());
    const shell = await take('agent-0', 't-shell', 'shell-run');
    await fs.rm(path.join(shell.work, 'src/data/.gitkeep'));
    await writeInCopy(
      shell.work,
      'src/data/pets.json',
      `{ "items": [] }
`
    );
    expect((await completeTask(shell.ctx, 'shell-run', 't-shell')).changed).toEqual([
      'src/data/.gitkeep',
      'src/data/pets.json'
    ]);
  });

  it('the brake waits for enough to judge, resuming clears what it saw, and the report says it stopped', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('open');

    await stopRun(lead(), 'es-launch', false);
    expect((await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'stopping')?.text).toContain(
      'stopped by lead'
    );
    await resumeRun(lead(), 'es-launch');
    expect((await loadRun(lead(), 'es-launch')).record.brake).toEqual([]);
    const report = await buildReport(lead(), await loadRun(lead(), 'es-launch'));
    expect(report.stops).toMatchObject([{ reason: 'stopped by lead', by: 'lead' }]);
  });

  it('a heartbeat says when the task can be reassigned and taken; run status lists tasks in the plan’s order', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const signal = await reportProgress(home.ctx, 'es-launch', 't-home', {});

    expect(Date.parse(signal.quietAfter) - Date.parse(signal.at)).toBe(DEFAULTS.noSignalMs);
    expect(Date.parse(signal.takenAfter) - Date.parse(signal.quietAfter)).toBe(DEFAULTS.lockAfterSignalMs);
    expect((await viewRun(lead(), 'es-launch')).tasks.map(task => task.id)).toEqual([
      't-home',
      't-menu',
      't-book',
      't-about'
    ]);
  });
});

describe('a team: roles, a lead who talks to the agents, and nothing left behind', () => {
  it('gives each role its tasks: next picks for the role, and take refuses another role’s', async () => {
    const plan = benchPlan();
    plan.tasks[1].role = 'designer';
    await open(plan);

    expect((await nextTask(lead(), 'es-launch', 'designer')).task?.id).toBe('t-menu');
    expect((await nextTask(lead(), 'es-launch', 'writer')).why).toContain('nothing ready for a writer');
    expect((await refusal(takeTask(bench.agent('dev'), 'es-launch', 't-menu', 'developer'))).message).toContain(
      'a designer’s, not a developer’s'
    );
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-menu')?.role).toBe('designer');
  });

  it('an agent of several roles waits for work with --follow, and is told when its roles have none left', async () => {
    const plan = benchPlan();
    plan.tasks[1].role = 'designer';
    plan.tasks[2].role = 'designer';
    await open(plan);

    expect((await nextTask(lead(), 'es-launch', 'designer,writer')).task?.id).toBe('t-menu');
    await doTask(
      'agent-1',
      't-menu',
      'src/space/pages/menu.ts',
      `export const menu = {};
`
    );
    // Work ready for other roles is no reason to stop waiting: it waits the whole time it was given.
    const since = Date.now();
    const waiting = await followNext(lead(), 'es-launch', 'designer', { timeoutMs: 60, everyMs: 10 });
    expect(Date.now() - since).toBeGreaterThanOrEqual(55);
    expect(waiting.task).toBeUndefined();
    expect(waiting.finished).toBeUndefined();

    await doTask(
      'agent-2',
      't-home',
      'src/space/pages/home/hero.ts',
      `export const hero = {};
`
    );
    expect((await followNext(lead(), 'es-launch', 'designer', { timeoutMs: 30, everyMs: 10 })).task?.id).toBe('t-book');
    await doTask(
      'agent-1',
      't-book',
      'src/space/pages/book.ts',
      `export const book = {};
`
    );
    expect(await followNext(lead(), 'es-launch', 'designer', { timeoutMs: 30, everyMs: 10 })).toMatchObject({
      finished: true
    });
  });

  it('is not finished while a task of its roles is in review or in another agent’s hands', async () => {
    const plan = benchPlan();
    plan.tasks.forEach(task => {
      task.role = 'writer';
      task.dependsOn = [];
    });
    plan.tasks[0].role = 'designer';
    await open(plan);
    const home = await take('agent-1', 't-home');
    expect((await nextTask(bench.agent('agent-2'), 'es-launch', 'designer')).finished).toBeUndefined();
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    expect((await nextTask(bench.agent('agent-2'), 'es-launch', 'designer')).finished).toBeUndefined();
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    expect((await nextTask(bench.agent('agent-2'), 'es-launch', 'designer')).finished).toBe(true);
  });

  it('a task is not approved over a question it asked the lead that is not answered; done, its token says so', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const asked = await askLead(home.ctx, 'es-launch', 't-home', 'Overdue mark too?');
    await tellLead(home.ctx, 'es-launch', 't-home', 'Kept the old title for the hero');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');

    const refused = await refusal(reviewTask(lead(), 'es-launch', 't-home', 'approve', []));
    expect(refused.message).toContain(`asked ${asked.question.id}`);
    await messageTasks(lead(), 'es-launch', 't-home', 'Not this time', asked.question.id);
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);

    const after = await refusal(readInbox(home.ctx, 'es-launch', 't-home'));
    expect([after.code, after.message]).toEqual(['invalid', expect.stringContaining('is done') as unknown]);
  });

  it('shows a task as its lead reviews it: each file’s diff, its checks, what was said, what to run next', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = ${JSON.stringify({ text: 'Hola' })};\n`
    );
    await askLead(home.ctx, 'es-launch', 't-home', 'Formal or informal?');
    await completeTask(home.ctx, 'es-launch', 't-home');

    const shown = await showTask(lead(), 'es-launch', 't-home');
    expect([shown.status, shown.from, shown.checks, shown.holder]).toEqual(['in-review', 'copy', 'passed', 'agent-1']);
    expect(shown.files).toMatchObject([{ file: 'src/space/pages/home/hero.ts', change: 'changed' }]);
    expect(shown.files[0].diff).toMatch(/^\+export const hero = \{"text":"Hola"\};$/m);
    expect(shown.messages.map(message => message.text)).toEqual(['Formal or informal?']);
    expect(shown.next.join('\n')).toContain('plitzi task review t-home --approve');
    expect((await refusal(showTask(home.ctx, 'es-launch', 't-home'))).code).toBe('person-only');
  });

  it('the lead looks at a task in review in its copy, served until it leaves review', async () => {
    const answer = 'copy';
    await bench.write(
      'serve.mjs',
      `import http from 'node:http';\n\nhttp.createServer((q, r) => r.end('${answer}')).listen(process.env.PORT);\n`
    );
    await bench.write(
      'package.json',
      `${JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { start: 'node serve.mjs' } })}\n`
    );
    await open();
    const home = await take('agent-1', 't-home');
    expect((await refusal(startTaskPreview(lead(), 'es-launch', 't-home', 18_391))).code).toBe('invalid');

    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    const preview = await startTaskPreview(lead(), 'es-launch', 't-home', 18_391);
    expect(preview.dir).toBe(home.work);
    let served = '';
    for (let tries = 0; served === '' && tries < 50; tries += 1) {
      served = await fetch(preview.url).then(
        response => response.text(),
        () => new Promise<string>(resolve => setTimeout(() => resolve(''), 100))
      );
    }
    expect(served).toBe(answer);

    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    expect((await preview.done).why).toContain('t-home is done now');
  }, 15_000);

  it('the lead waiting in the background is woken once for each thing that needs it, and told when the run is gone', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    expect(await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).toMatchObject({ timedOut: true });

    await askLead(home.ctx, 'es-launch', 't-home', 'Spanish or Catalan?');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    const woken = await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 });
    expect(woken.fresh.map(item => item.key.split(':')[0]).sort()).toEqual(['message', 'review']);
    expect(await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).toMatchObject({
      fresh: [],
      timedOut: true
    });

    await abortRun(bench.person(true), 'es-launch');
    expect(await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).toMatchObject({ gone: true });
  });

  it('an agent waiting for work hears first that its blocked task was unblocked, with the answer it waited for', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await blockTask(home.ctx, 'es-launch', 't-home', 'Which opening hours?', 'person');
    expect((await nextTask(bench.agent('agent-1'), 'es-launch')).yours).toBeUndefined();
    await doTask('agent-3', 't-menu', 'src/space/pages/menu.ts', 'export const menu = { approved: true };\n');

    await unblockTask(lead(), 'es-launch', 't-home', 'Monday to Friday, 9 to 17 UTC');
    // A block can last: what was approved meanwhile is in its copy as it goes on.
    expect(await readInCopy(home.work, 'src/space/pages/menu.ts')).toContain('approved: true');
    const again = await refusal(takeTask(bench.agent('agent-1'), 'es-launch', 't-home'));
    expect(again).toMatchObject({ code: 'claimed', detail: { yours: true } });
    const next = await followNext(bench.agent('agent-1'), 'es-launch', undefined, { timeoutMs: 30, everyMs: 10 });
    expect(next).toMatchObject({ yours: 'in-progress', task: { id: 't-home' } });
    expect((await nextTask(bench.agent('agent-2'), 'es-launch')).task?.id).not.toBe('t-home');
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).messages.map(each => each.text)).toEqual([
      'Monday to Friday, 9 to 17 UTC'
    ]);
  });

  it('the lead reaches an agent by name between tasks: next --follow wakes for it, and take hands over the rest', async () => {
    const plan = benchPlan();
    plan.tasks[2].role = 'designer';
    await open(plan);
    const waiting = followNext(bench.agent('agent-1'), 'es-launch', 'designer', { timeoutMs: 2000, everyMs: 10 });
    await new Promise(resolve => setTimeout(resolve, 30));
    await messageTasks(lead(), 'es-launch', '@agent-1', 'Take developer tasks too');
    const woken = await waiting;
    expect([woken.task, woken.messages.map(message => message.text)]).toEqual([
      undefined,
      ['Take developer tasks too']
    ]);

    await messageTasks(lead(), 'es-launch', '@agent-1', 'Start with the menu');
    const taken = await takeTask(bench.agent('agent-1'), 'es-launch', 't-menu');
    expect(taken.messages.map(message => message.text)).toEqual(['Start with the menu']);
    expect((await refusal(messageTasks(lead(), 'es-launch', '@no such', 'Hi'))).code).toBe('not-found');
  });

  it('the limit counts agents, not tasks: one holding two is one, and another agent waits', async () => {
    await open(benchPlan(), { agents: 1 });
    const home = await take('agent-1', 't-home');
    await blockTask(home.ctx, 'es-launch', 't-home', 'Which opening hours?', 'lead');
    await unblockTask(lead(), 'es-launch', 't-home', 'Nine to five');

    expect((await takeTask(bench.agent('agent-1'), 'es-launch', 't-menu')).task.id).toBe('t-menu');
    const refused = await refusal(takeTask(bench.agent('agent-2'), 'es-launch', 't-about'));
    expect(refused).toMatchObject({ code: 'agent-limit', detail: { working: ['t-home', 't-menu'], limit: 1 } });
    expect(refused.message).toContain('1 of the 1 agents');
    // `next` offers what its caller can take: the limit full, it says so, and --follow waits for a place.
    expect(await nextTask(bench.agent('agent-2'), 'es-launch')).toMatchObject({ full: true });
    expect((await nextTask(bench.agent('agent-2'), 'es-launch')).task).toBeUndefined();
  });

  it('an agent waiting for work waits through a gentle stop, and gets its task once the run is resumed', async () => {
    await open();
    await stopRun(lead(), 'es-launch', false);
    const waiting = followNext(bench.agent('agent-1'), 'es-launch', undefined, { timeoutMs: 2000, everyMs: 10 });
    await new Promise(resolve => setTimeout(resolve, 40));
    await resumeRun(lead(), 'es-launch');
    expect((await waiting).task?.id).toBe('t-home');

    // And through one a person forces: what is in hand is cut, and the agent between tasks waits for the resume.
    await stopRun(bench.person(true), 'es-launch', true);
    const again = followNext(bench.agent('agent-2'), 'es-launch', undefined, { timeoutMs: 2000, everyMs: 10 });
    await new Promise(resolve => setTimeout(resolve, 40));
    await resumeRun(lead(), 'es-launch');
    expect((await again).task).toBeDefined();
  });

  it('a check that fails without the task too is not the task’s: it goes to review, said to the lead', async () => {
    await open();
    // A person's edit in the project that fails the checks reaches every copy made after it.
    await bench.write('src/space/pages/about.ts', 'export const about = BROKEN;\n');
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');

    await completeTask(home.ctx, 'es-launch', 't-home');
    const view = await viewRun(lead(), 'es-launch');
    expect(view.tasks.find(task => task.id === 't-home')?.status).toBe('in-review');
    const shown = await showTask(lead(), 'es-launch', 't-home');
    expect(shown.checks).toMatchObject({ knownFailure: { preexisting: true, failing: ['author'] } });
    expect(view.attention.some(item => item.kind === 'known-failure' && item.task === 't-home')).toBe(true);
  });

  it('a task completes over failing checks only with a reason and the task that fixes it — said to both and the lead', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'BROKEN\n');
    expect((await refusal(completeTask(home.ctx, 'es-launch', 't-home'))).detail).toMatchObject({
      next: expect.stringContaining('--known-failure') as unknown
    });
    expect(
      (await refusal(completeTask(home.ctx, 'es-launch', 't-home', { knownFailure: { why: 'x', fixedBy: 't-home' } })))
        .message
    ).toContain('is this task');

    const completed = await completeTask(home.ctx, 'es-launch', 't-home', {
      knownFailure: { why: 'the hero waits for the menu’s tokens', fixedBy: 't-book' }
    });
    expect(completed.checks.ok).toBe(false);
    const view = await viewRun(lead(), 'es-launch');
    expect(view.attention.some(item => item.kind === 'known-failure' && item.text.includes('t-book fixes it'))).toBe(
      true
    );
    const book = await taskContext(lead(), 'es-launch', 't-book');
    expect(book.state.notes.at(-1)?.text).toContain('for you to fix');
  });

  it('an agent asks the lead and the answer reaches it with its next heartbeat; the lead tells every task at once', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    const asked = await askLead(home.ctx, 'es-launch', 't-home', 'Spanish or Catalan for the hero?');

    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'message')).toBe(true);
    expect((await readInbox(lead(), 'es-launch')).map(message => message.text)).toEqual([
      'Spanish or Catalan for the hero?'
    ]);
    await messageTasks(lead(), 'es-launch', 't-home', 'Spanish', asked.question.id);
    await messageTasks(lead(), 'es-launch', 'all', 'Keep the menu link as it is');

    const signal = await reportProgress(home.ctx, 'es-launch', 't-home', {});
    expect(signal.messages.map(message => message.text)).toEqual(['Spanish', 'Keep the menu link as it is']);
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).messages).toEqual([]);
    expect((await readInbox(menu.ctx, 'es-launch', 't-menu')).map(message => message.text)).toEqual([
      'Keep the menu link as it is'
    ]);
    const unread = await askLead(menu.ctx, 'es-launch', 't-menu', 'Prices with the euro sign?');
    await messageTasks(lead(), 'es-launch', 't-menu', 'Yes', unread.question.id);
    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'message')).toBe(false);

    // Told, not asked: on top of the run until the lead reads it, and never waiting for an answer.
    await tellLead(menu.ctx, 'es-launch', 't-menu', 'The menu prices come from menu.json, not the page');
    expect(
      (await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'message' && item.text.includes('says'))
        ?.text
    ).toContain('for you to know');
    await readInbox(lead(), 'es-launch');
    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.text.includes('for you to know'))).toBe(
      false
    );

    // What ask --follow marks read on the way to its answer reaches the agent with it, and --all shows it again.
    await messageTasks(lead(), 'es-launch', 't-menu', 'Euros, two decimals');
    const asking = askLead(menu.ctx, 'es-launch', 't-menu', 'Anything else?', {
      follow: true,
      timeoutMs: 2000,
      everyMs: 10
    });
    await new Promise(resolve => setTimeout(resolve, 30));
    const question = (await readInbox(lead(), 'es-launch')).find(message => message.text === 'Anything else?');
    await messageTasks(lead(), 'es-launch', 't-menu', 'No', question?.id);
    const answered = await asking;
    expect([answered.reply?.text, answered.messages.map(message => message.text)]).toEqual([
      'No',
      ['Yes', 'Euros, two decimals']
    ]);
    expect((await readInbox(menu.ctx, 'es-launch', 't-menu', true)).map(message => message.text)).toContain(
      'Euros, two decimals'
    );

    const followed = await askLead(home.ctx, 'es-launch', 't-home', 'And the title?', {
      follow: true,
      timeoutMs: 50,
      everyMs: 10
    });
    expect(followed.reply).toBeUndefined();
  });

  it('removes the plan and the summary it was handed with the run, unless they changed since', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = {};
`
    );
    await bench.write('summary.md', 'changed after it was handed\n');
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });

    expect(done.inputs).toEqual({ removed: ['es-launch.plan.json'], kept: ['summary.md'] });
    expect(await bench.read('es-launch.plan.json')).toBeUndefined();
  });

  it('a running preview takes each approval in; none running, nothing is written', async () => {
    await open();
    const loaded = await loadRun(lead(), 'es-launch');
    const dir = path.join(loaded.paths.cache, 'preview');
    await fs.mkdir(dir, { recursive: true });
    expect(await syncPreview(loaded, bench.root)).toBe(false);

    await fs.writeFile(path.join(loaded.paths.cache, 'preview.json'), JSON.stringify({ pid: process.pid, port: 8300 }));
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    expect(await fs.readFile(path.join(dir, 'src/space/pages/about.ts'), 'utf-8')).toContain('Sobre');

    // Reverted, its file is the project's again in the preview.
    await revertTask(lead(), 'es-launch', 't-about');
    expect(await fs.readFile(path.join(dir, 'src/space/pages/about.ts'), 'utf-8')).toBe(
      await bench.read('src/space/pages/about.ts')
    );
  });

  it('what was built on a reverted task waits for it again', async () => {
    await open();
    await doTask('agent-1', 't-home', 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await doTask('agent-2', 't-menu', 'src/space/pages/menu.ts', 'export const menu = {};\n');
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-book')?.status).toBe('ready');

    const reverted = await revertTask(lead(), 'es-launch', 't-home', 'the hero lost its subtitle');
    expect(reverted.waiting).toEqual(['t-book']);
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-book')?.status).toBe('pending');
    expect((await nextTask(bench.agent('agent-3'), 'es-launch')).task?.id).toBe('t-home');
    expect((await take('agent-3', 't-home')).messages.map(message => message.text)).toEqual([
      'This task was reverted and is to be done again: the hero lost its subtitle'
    ]);
  });

  it('says which files outside the plan import what a task changes', async () => {
    const theme = benchPlan();
    theme.tasks = [{ ...theme.tasks[0], files: ['src/space/theme.ts'] }];
    const reading = await checkPlan(bench.root, theme, await readOwnership(bench.root), 3);
    expect(reading.tasks[0].files).toEqual(['src/space/theme.ts']);
    expect(
      reading.notices.some(notice => notice.startsWith('src/space/pages/menu.ts imports src/space/theme.ts (t-home)'))
    ).toBe(true);
  });
});

describe('turns let go', () => {
  it('releases a file held by turns to the next in line', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await claimFile(home.ctx, 'es-launch', 't-home', 'src/space/tokens.ts');
    await waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/tokens.ts');

    expect(await releaseFile(home.ctx, 'es-launch', 't-home', 'src/space/tokens.ts')).toEqual([
      'src/space/tokens.ts → t-menu'
    ]);
  });
});

describe('the run’s primitives', () => {
  it('creates a file exclusively: one caller of many', async () => {
    const file = path.join(bench.root, 'owner.json');
    const results = await Promise.all(Array.from({ length: 20 }, (_, n) => createExclusive(file, String(n))));

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
