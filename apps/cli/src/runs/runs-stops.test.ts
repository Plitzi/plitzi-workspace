import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { abortRun, finishRun } from './merge';
import { RUNS_DIR, runPaths } from './paths';
import { isRunRefusal } from './refusal';
import {
  attachRun,
  checkPlanFile,
  loadRun,
  pruneRuns,
  purgeRun,
  releaseRun,
  resumeRun,
  stopRun,
  writingTasks
} from './run';
import { messageTasks } from './talk';
import { canWrite, checkTask, completeTask, nextTask, reportProgress, reviewTask, takeTask } from './tasks';
import { brakeFailuresFor, DEFAULTS } from './taskStore';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** A run stopped, cut and disconnected — and attached again on another machine or version. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, openWith, open, take, doTask } = runSteps(() => bench);

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

  it('the brake stops a run that keeps failing — one more failure allowed for each agent', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'BROKEN\n');
    // Four agents: five, and three more.
    expect(brakeFailuresFor(4)).toBe(8);
    for (let attempt = 0; attempt < brakeFailuresFor(4); attempt += 1) {
      await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    }

    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('open');
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect((await loadRun(lead(), 'es-launch')).record.status).toBe('stopping');
  });

  it('checks a copy without completing it — and counts nothing against the run', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'BROKEN\n');
    for (let attempt = 0; attempt <= brakeFailuresFor(4); attempt += 1) {
      expect(await checkTask(home.ctx, 'es-launch', 't-home')).toMatchObject({ ok: false, checks: { ok: false } });
    }

    expect((await loadRun(lead(), 'es-launch')).record).toMatchObject({ status: 'open', brake: [] });
    // What the lead says meanwhile reaches an agent that only checks.
    await messageTasks(lead(), 'es-launch', 't-home', 'Use the formal voice');
    expect((await checkTask(home.ctx, 'es-launch', 't-home')).messages.map(message => message.text)).toEqual([
      'Use the formal voice'
    ]);
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Bienvenidos" };\n');
    expect(await checkTask(home.ctx, 'es-launch', 't-home')).toMatchObject({ ok: true });
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.status).toBe('in-progress');
  });

  it('brings into a copy what a person changed in the project since it was made — never over the task’s own work', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Bienvenidos" };\n');
    // A person formats a file no task holds, and one this task holds and changed.
    await bench.write('src/space/theme.ts', 'export const theme = { tone: "formatted" };\n');
    await bench.write('src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    const checked = await checkTask(home.ctx, 'es-launch', 't-home');
    expect(checked.brought).toEqual(['src/space/theme.ts']);
    expect(await readInCopy(home.work, 'src/space/theme.ts')).toContain('formatted');
    expect(await readInCopy(home.work, 'src/space/pages/home/hero.ts')).toContain('Bienvenidos');
    expect((await completeTask(home.ctx, 'es-launch', 't-home')).changed).toEqual(['src/space/pages/home/hero.ts']);
  });
});

describe('what an agent leaves in the project', () => {
  it('says what appeared in the project’s tmp/ while the run is open — never what the tools keep there', async () => {
    const plan = await bench.writePlan(benchPlan());
    await openWith(lead(), plan, 4);
    await bench.write('tmp/dev1/s.mjs', 'console.log(1);\n');
    await bench.write('tmp/lead2-preview.log', 'listening\n');
    await bench.write('tmp/shots/home.png', 'png');
    await bench.write('tmp/dev-server.json', '{}');

    const left = (await viewRun(lead(), 'es-launch')).attention.filter(item => item.kind === 'left-in-tmp');
    expect(left.map(item => item.file)).toEqual(['tmp/dev1/', 'tmp/lead2-preview.log']);
    expect(left[0].text).toContain('scratch');

    // Whoever left it hears it with its next command — once — and is handed a folder of its own in the run.
    const next = await nextTask(bench.agent('agent-1'), 'es-launch');
    expect(next.messages.map(message => message.text)).toEqual([
      expect.stringContaining('tools: tmp/dev1/, tmp/lead2-preview.log. The project')
    ]);
    expect(next.scratch).toBe(path.join(bench.root, 'tmp/plitzi-runs/es-launch/scratch/agent-1'));
    expect((await fs.stat(next.scratch)).isDirectory()).toBe(true);
    expect((await nextTask(bench.agent('agent-1'), 'es-launch')).messages).toEqual([]);
  });
});

describe('a run that ends under its preview', () => {
  it('stops the preview before its folder goes — never a server left in a folder removed under it', async () => {
    await openWith(lead(), await bench.writePlan(benchPlan()), 4);
    const paths = runPaths(bench.root, 'es-launch');
    const seen = path.join(bench.root, 'preview-saw.txt');
    // A preview as `run preview` is: it looks for its run, and stops once the run is gone — saying whether its folder
    // was still there when it did.
    const preview = spawn(
      process.execPath,
      [
        '-e',
        `const fs = require('node:fs');
         const tick = setInterval(() => {
           if (!fs.existsSync(${JSON.stringify(paths.record)})) {
             fs.writeFileSync(${JSON.stringify(seen)}, String(fs.existsSync(${JSON.stringify(paths.dir)})));
             clearInterval(tick);
           }
         }, 50);`
      ],
      { stdio: 'ignore' }
    );
    await fs.mkdir(paths.cache, { recursive: true });
    await fs.writeFile(path.join(paths.cache, 'preview.json'), JSON.stringify({ pid: preview.pid, port: 8300 }));

    await abortRun(bench.person(true), 'es-launch');

    expect(await fs.readFile(seen, 'utf-8')).toBe('true');
    await expect(fs.access(paths.dir)).rejects.toThrow();
    // The last run gone, the runs' folder goes with it: the project's tmp/ as the run found it.
    await expect(fs.access(path.join(bench.root, RUNS_DIR))).rejects.toThrow();
  });
});

describe('a gentle stop to upgrade', () => {
  it('says what is still being written — what run upgrade waits for — and why it stops', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await take('agent-2', 't-menu');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = { title: "Inicio" };\n');
    await stopRun(lead(), 'es-launch', false, 'stopping to upgrade Plitzi');
    expect((await loadRun(lead(), 'es-launch')).record).toMatchObject({
      status: 'stopping',
      stopReason: 'stopping to upgrade Plitzi'
    });
    expect((await writingTasks(lead(), 'es-launch')).sort()).toEqual(['t-home', 't-menu']);

    // A task in review is finished work: nothing is written in it.
    await completeTask(home.ctx, 'es-launch', 't-home');
    expect(await writingTasks(lead(), 'es-launch')).toEqual(['t-menu']);
  });
});

describe('versions, machines and caches', () => {
  it('refuses every command when the Plitzi version changed under the run; a person re-pins it by attaching', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = { title: "Inicio" };\n');
    const upgraded = bench.agent('agent-2', { cli: '0.0.1-bench' });

    expect((await refusal(nextTask(upgraded, 'es-launch'))).code).toBe('version-mismatch');
    expect((await refusal(attachRun(upgraded, 'es-launch', false))).code).toBe('person-only');
    const attached = await attachRun({ ...bench.person(true), cli: '0.0.1-bench' }, 'es-launch', false);
    // An upgrade on this machine loses no work: the task in hand keeps its copy and its agent, and is told so.
    expect(attached).toMatchObject({ repinned: true, cut: [], kept: ['t-home'] });
    const back = await nextTask({ ...home.ctx, cli: '0.0.1-bench', token: undefined }, 'es-launch');
    expect(back).toMatchObject({ task: { id: 't-home' }, yours: 'in-progress' });
    expect(back.messages.map(message => message.text).join(' ')).toContain('your copy and your work are kept');
    expect(await completeTask({ ...home.ctx, cli: '0.0.1-bench' }, 'es-launch', 't-home')).toMatchObject({
      changed: ['src/space/pages/home/index.ts']
    });
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

    expect((await refusal(checkPlanFile(lead(), file))).code).toBe('another-run');
    const refused = await refusal(openWith(lead(), file, 1));
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

    expect((await refusal(openWith(lead(), file, 3))).message).toContain('"cut" is opening');
    bench.advance(3 * 60_000);
    await openWith(lead(), file, 3);
    expect((await loadRun(lead(), 'es-launch')).record.agents).toBe(3);
  });

  it('of two runs opening at once, one opens', async () => {
    const first = await bench.writePlan(benchPlan('first'));
    const second = await bench.writePlan(benchPlan('second'));
    const results = await Promise.allSettled([openWith(lead(), first, 4), openWith(lead(), second, 4)]);

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
