import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEV_SERVER_FILE, projectMark } from '@plitzi/sdk-shared/project';

import { freePort } from './acceptance';
import { materialise } from './materialise';
import { finishRun } from './merge';
import { lockFile, runPaths, taskPaths } from './paths';
import { startTaskPreview } from './preview';
import { isRunRefusal } from './refusal';
import { writeSummary } from './report';
import { loadRun, stopRun } from './run';
import {
  canWrite,
  completeTask,
  discardFile,
  nextTask,
  reassignTask,
  reportProgress,
  reviewTask,
  takeTask
} from './tasks';
import { changesBlock } from './tasks/review';
import { viewTask } from './taskStore';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { LEAD_SAID, runSteps } from '../tests/runSteps';

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
  it('sees a picture it does not own changed in its copy, though it never read it whole', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-home');
    await writeInCopy(held.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await fs.writeFile(path.join(held.work, 'public', 'logo.png'), '\u0089PNG-another-picture');

    const completed = await completeTask(held.ctx, runId, 't-home');
    expect(completed.changed).toContain('public/logo.png');
  });

  it('has the pictures it does not own in the copy the whole result is checked in too', async () => {
    await open();
    const checked = await materialise(lead(), await loadRun(lead(), 'es-launch'), {});
    try {
      expect(await readInCopy(checked, 'public/logo.png')).toContain('PNG');
      expect(await readInCopy(checked, '.env')).toBeUndefined();
    } finally {
      await fs.rm(checked, { recursive: true, force: true });
    }
  });

  it('locks its files and copies the project — never its credentials, never node_modules', async () => {
    await bench.write('node_modules/pkg/index.js', 'module.exports = 1;\n');
    const runId = await open();
    const held = await take('agent-1', 't-home');

    expect(await readInCopy(held.work, 'src/space/pages/home/hero.ts')).toContain('Welcome');
    expect(await readInCopy(held.work, '.env')).toBeUndefined();
    expect(await readInCopy(held.work, '.env.example')).toContain('PLITZI_SECRET=');
    expect(await readInCopy(held.work, 'node_modules/pkg/index.js')).toBeUndefined();
    // The pictures it does not own come too, cloned unread, so its pages draw them.
    expect(await readInCopy(held.work, 'public/logo.png')).toContain('PNG');
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
    await writeSummary(lead(), 'eight', 'summary.md', LEAD_SAID);
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
    bench.advance(60_000);
    for (const task of plan.tasks) {
      await reviewTask(lead(), 'eight', task.id, 'approve', []);
    }

    // A report written before the approvals says nothing of them: the dry run says so, and is not ready; --apply refuses.
    const dry = await finishRun(lead(), 'eight', { apply: false, leavePending: false });
    expect(dry.summaryBehind).toHaveLength(8);
    const refused = await refusal(finishRun(bench.person(true), 'eight', { apply: true, leavePending: false }));
    expect([refused.code, refused.message]).toEqual([
      'invalid',
      expect.stringContaining('report was written before t1, t2, t3, t4, t5, t6, t7, t8 were approved') as unknown
    ]);
    await writeSummary(lead(), 'eight', 'summary.md', LEAD_SAID);
    expect((await finishRun(lead(), 'eight', { apply: false, leavePending: false })).summaryBehind).toBeUndefined();

    await finishRun(bench.person(true), 'eight', { apply: true, leavePending: false });
    for (let n = 1; n <= 8; n += 1) {
      expect(await bench.read(`src/space/pages/p${String(n)}.ts`)).toContain(`página ${String(n)}`);
    }
    // Eight agents and their copies at once: ~3 s alone, past the default 5 s beside the rest of the suite.
  }, 30_000);
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

    // From a task's token, the lead's to do or to ask for: the agent tells it — no person is its to ask.
    expect((await refusal(finishRun(home.ctx, 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'lead-only'
    );
    expect((await refusal(stopRun(lead(), 'es-launch', true))).code).toBe('person-only');
    expect((await refusal(reviewTask(home.ctx, 'es-launch', 't-home', 'approve', []))).code).toBe('lead-only');
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

  it('sends changes back to the same task, and after three rounds blocks it for the lead to decide', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    for (let round = 1; round <= 3; round += 1) {
      await writeInCopy(
        home.work,
        'src/space/pages/home/hero.ts',
        `export const hero = { text: 'v${String(round)}' };\n`
      );
      await completeTask(home.ctx, 'es-launch', 't-home');
      // Said to the reviewer before it asks: its last round's changes block the task (design-2 found out after).
      const loaded = await loadRun(lead(), 'es-launch');
      const task = loaded.tasks.find(each => each.id === 't-home');
      if (!task) {
        throw new Error('the run has no t-home');
      }

      expect(changesBlock((await viewTask(loaded.paths, task)).state)).toBe(round === 3);
      const reviewed = await reviewTask(lead(), 'es-launch', 't-home', 'changes', [
        { note: 'shorter', element: 'hero-title' }
      ]);
      expect(reviewed.toLead).toBe(round === 3);
    }

    const view = await viewRun(lead(), 'es-launch');
    expect(view.tasks.find(task => task.id === 't-home')?.status).toBe('blocked');
    // The lead's to decide — it speaks to the person, if it must — never a person's the run has none of.
    expect(view.attention).toContainEqual(
      expect.objectContaining({
        kind: 'blocked',
        who: 'lead',
        text: expect.stringContaining('the lead decides') as unknown
      })
    );
    expect((await refusal(reviewTask(bench.agent('agent-2'), 'es-launch', 't-home', 'approve', []))).code).toBe(
      'lead-only'
    );
    expect((await reviewTask(lead(), 'es-launch', 't-home', 'approve', [])).verdict).toBe('approve');
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.status).toBe('done');
  });

  it('looks at a copy where its agent’s own server already serves it — never a second server fighting its state', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    // Its `/health` names the copy it serves, as a project's server does: a port left by another names another.
    const own = http.createServer((_request, response) =>
      response.end(JSON.stringify({ Instance: projectMark(home.work) }))
    );
    const port = await freePort();
    await new Promise<void>(resolve => own.listen(port, '127.0.0.1', resolve));
    try {
      await writeInCopy(home.work, DEV_SERVER_FILE, JSON.stringify({ port }));
      const preview = await startTaskPreview(lead(), 'es-launch', 't-home', await freePort(), { quiet: true });
      expect(preview).toMatchObject({ borrowed: { port, by: 'agent' }, url: `http://127.0.0.1:${String(port)}` });
      preview.stop();
      expect((await preview.done).why).toContain('asked to');
    } finally {
      own.close();
    }
  });

  it('does not offer a ready task whose file another task holds — it says whose, and an agent waits', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    // t-home holds t-about's file by turns, as a task holds a shared one it changed.
    const lock = lockFile(taskPaths(runPaths(bench.root, 'es-launch'), 't-home'), 'src/space/pages/about.ts');
    await fs.mkdir(path.dirname(lock), { recursive: true });
    await fs.writeFile(
      lock,
      JSON.stringify({
        runId: 'es-launch',
        taskId: 't-home',
        agent: 'agent-1',
        intent: 'by turns',
        since: new Date().toISOString(),
        kind: 'turn'
      })
    );
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');

    const offered = await nextTask(bench.agent('agent-2'), 'es-launch');
    expect(offered.task?.id).not.toBe('t-about');
  });

  it('tells an agent at another task that the one sent back goes first, when others wait on it', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    const menu = await take('agent-1', 't-menu');
    const reviewed = await reviewTask(lead(), 'es-launch', 't-home', 'changes', [{ note: 'shorter' }]);
    expect(reviewed.goesFirst).toEqual(['t-book']);
    const told = (await reportProgress(menu.ctx, 'es-launch', 't-menu', {})).messages.map(message => message.text);
    expect(told).toEqual([expect.stringContaining('t-book waits on it: it goes before t-menu')]);
  });
});
