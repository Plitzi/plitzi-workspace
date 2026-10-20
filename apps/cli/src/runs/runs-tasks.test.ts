import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { finishRun } from './merge';
import { runPaths, taskPaths } from './paths';
import { isRunRefusal } from './refusal';
import { writeSummary } from './report';
import { stopRun } from './run';
import { canWrite, completeTask, discardFile, nextTask, reassignTask, reviewTask, takeTask } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** A task taken, written only in what is its own, and reviewed in the order of what it waits for. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, openWith, open, take, doTask } = runSteps(() => bench);

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
    await openWith(bench.person(true), await bench.writePlan(plan), 8);
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
