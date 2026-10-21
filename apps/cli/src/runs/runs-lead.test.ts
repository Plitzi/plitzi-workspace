import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { extendRun } from './extend';
import { waitForLead } from './leadWatch';
import { finishRun } from './merge';
import { readOwnership } from './ownership';
import { runPaths } from './paths';
import { checkPlan } from './plan';
import { allowLeadFinish, loadRun } from './run';
import {
  blockTask,
  completeTask,
  nextTask,
  reportProgress,
  revertTask,
  reviewTask,
  takeNext,
  taskContext,
  unblockTask
} from './tasks';
import { pendingRuns, viewRun } from './view';
import { benchPlan, makeBench, readInCopy, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Bench } from '../tests/runProject';

/** The lead’s plan as the run goes: its primer, its pace, a stage stacked on it, who finishes it, files too long, amendments. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, openWith, open, take, doTask } = runSteps(() => bench);

describe('the lead’s plan as the run goes', () => {
  it('starts every task from the lead’s primer and the few references its files need — and amends the primer', async () => {
    const plan = benchPlan();
    plan.primer = 'primer.md';
    await bench.write('primer.md', '# The bench\n\nPages are one file each; the tokens are shared.\n');
    for (const skill of [
      'plitzi-authoring/CHEATSHEET.md',
      'plitzi-authoring/reference/layouts.md',
      'plitzi-cli/reference/runs.md'
    ]) {
      await bench.write(`.claude/skills/${skill}`, '# skill\n');
    }
    await openWith(lead(), await bench.writePlan(plan), 4);
    const home = await take('agent-1', 't-home');

    const context = await taskContext(home.ctx, 'es-launch', 't-home');
    expect(context.primer).toContain('Pages are one file each');
    // A page: the cheatsheet and the run's protocol — not the layout's reference, which is no file of it.
    expect(context.reading).toEqual([
      '.claude/skills/plitzi-authoring/CHEATSHEET.md',
      '.claude/skills/plitzi-cli/reference/runs.md'
    ]);

    await bench.write('primer.md', '# The bench\n\nPages are one file each; the tokens are shared; dates are UTC.\n');
    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(plan))).toMatchObject({ primer: true });
    expect((await taskContext(home.ctx, 'es-launch', 't-home')).primer).toContain('dates are UTC');
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).messages.map(each => each.text)).toEqual([
      'The lead changed the run’s primer: read it again (plitzi task context)'
    ]);
  });

  it('refuses a primer that is not there or too long to be read whole by every agent', async () => {
    const plan = benchPlan();
    plan.primer = 'nowhere.md';
    expect((await refusal(openWith(lead(), await bench.writePlan(plan), 4))).message).toContain(
      'primer nowhere.md is not there'
    );
    plan.primer = 'long.md';
    await bench.write('long.md', 'x'.repeat(17 * 1024));
    expect((await refusal(openWith(lead(), await bench.writePlan(plan), 4))).message).toContain('over 16');
  });

  it('paces a plan by how this project’s runs went: their done tasks’ minutes over their estimates', async () => {
    const row = (task: string, minutes: number, estimate: number): string =>
      `| ${task} | developer | done | dev-1 | ${String(minutes)} / ${String(estimate)} | 1 | 0 | src/a.ts |`;
    await bench.write(
      'tmp/plitzi-reports/old-run-20261020T000000Z.md',
      [
        '## Tasks',
        '',
        ...[row('a', 5, 20), row('b', 10, 20), row('c', 5, 20), row('d', 10, 20), row('e', 10, 20)]
      ].join('\n')
    );

    const checked = await checkPlan(bench.root, benchPlan(), await readOwnership(bench.root), teamFor(benchPlan(), 2));
    expect(checked.estimate.paced).toEqual({
      ratio: 0.4,
      runs: 1,
      tasks: 5,
      wallMinutes: expect.any(Number) as unknown
    });
    expect(checked.estimate.paced?.wallMinutes).toBeLessThan(checked.estimate.wallMinutes);
  });

  it('stacks the next plan on a run done and waiting: begun from its work, written into the project in one finish', async () => {
    await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const menu = await take('agent-2', 't-menu');

    const stage = (tasks: RunPlan['tasks']): RunPlan => ({
      version: 1,
      runId: 'es-stage-2',
      goal: 'Contact page',
      tasks
    });
    const contact = {
      id: 't-contact',
      title: 'A contact page',
      files: ['src/space/pages/contact.ts'],
      dependsOn: ['t-about'],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: ['There is a contact page']
    };
    // A task still at work keeps its file, and an id is the run's once.
    const refused = await refusal(
      extendRun(
        lead(),
        'es-launch',
        await bench.writePlan(
          stage([
            { ...contact, files: ['src/space/pages/menu.ts'] },
            { ...contact, id: 't-about' }
          ])
        )
      )
    );
    expect(refused.message).toContain('src/space/pages/menu.ts is "t-menu"\'s, still at work');
    expect(refused.message).toContain('"t-about" the run has already');

    // One that waits for the holder starts after it, and finds the file free.
    const menuAgain = { ...contact, id: 't-menu-2', files: ['src/space/pages/menu.ts'], dependsOn: ['t-menu'] };
    expect(await extendRun(lead(), 'es-launch', await bench.writePlan(stage([contact, menuAgain])))).toMatchObject({
      added: ['t-contact', 't-menu-2'],
      ready: ['t-contact']
    });
    const held = await take('agent-3', 't-contact');
    // Begun where the run is: the approved about page is in its copy.
    expect(await readInCopy(held.work, 'src/space/pages/about.ts')).toContain('es: true');
    await writeInCopy(held.work, 'src/space/pages/contact.ts', 'export const contact = {};\n');
    await completeTask(held.ctx, 'es-launch', 't-contact');
    await reviewTask(lead(), 'es-launch', 't-contact', 'approve', []);
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await fs.readFile(path.join(bench.root, 'src/space/pages/contact.ts'), 'utf-8')).toContain('contact');
    expect(await fs.readFile(path.join(bench.root, 'src/space/pages/about.ts'), 'utf-8')).toContain('es: true');
  });

  it('lists the runs waiting to be written into the project, the ready ones first, with what applies each', async () => {
    await open();
    expect(await pendingRuns(lead())).toMatchObject([{ runId: 'es-launch', ready: false, done: 0, total: 4 }]);
    for (const [task, file] of [
      ['t-home', 'src/space/pages/home/hero.ts'],
      ['t-menu', 'src/space/pages/menu.ts'],
      ['t-about', 'src/space/pages/about.ts'],
      ['t-book', 'src/space/pages/book.ts']
    ] as const) {
      await doTask('agent-1', task, file, 'export const done = true;\n');
    }

    expect(await pendingRuns(lead())).toMatchObject([
      { runId: 'es-launch', ready: true, leadFinishes: false, apply: 'npx plitzi run finish es-launch --apply' }
    ]);
  });

  it('wakes the lead for a task done again after a revert, and never calls a task in review silent', async () => {
    await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    await completeTask(about.ctx, 'es-launch', 't-about');
    expect(
      (await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).fresh.map(item => item.key)
    ).toEqual([expect.stringMatching(/^review:t-about:0:/)]);
    // In review for hours, its agent long gone to other work: nothing to reassign.
    bench.advance(3 * 60 * 60_000);
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-about')?.noSignal).toBe(false);

    await reviewTask(lead(), 'es-launch', 't-about', 'approve', []);
    await revertTask(lead(), 'es-launch', 't-about', 'Say it in the formal voice');
    // The agent who did it hears it by name, wherever it is now.
    expect((await nextTask(bench.agent('agent-1'), 'es-launch')).messages.map(each => each.text)).toEqual([
      'Your work on t-about was reverted: Say it in the formal voice — out of the run; plitzi task next hands it on'
    ]);
    const again = await take('agent-2', 't-about');
    await writeInCopy(again.work, 'src/space/pages/about.ts', 'export const about = { formal: true };\n');
    await completeTask(again.ctx, 'es-launch', 't-about');
    expect(
      (await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).fresh.map(item => item.text)
    ).toContain('t-about is in review: plitzi task review t-about --approve | --changes "…"');
  });

  it('takes the next task in the same breath, and tells an agent done with the run how its own work ended', async () => {
    await open(benchPlan(), { agents: 4 });
    const first = await takeNext(bench.agent('agent-1'), 'es-launch', undefined);
    expect(first.taken?.task.id).toBe('t-home');
    const second = await takeNext(bench.agent('agent-2'), 'es-launch', undefined);
    expect(second.taken?.task.id).toBe('t-menu');
    // Its own task handed back is not taken again: its token is still good.
    await blockTask(
      bench.agent('agent-1', { token: String(first.taken?.token) }),
      'es-launch',
      't-home',
      'Which hours?',
      'lead'
    );
    await unblockTask(lead(), 'es-launch', 't-home', '9 to 17');
    expect(await takeNext(bench.agent('agent-1'), 'es-launch', undefined)).toMatchObject({
      next: { yours: 'in-progress', task: { id: 't-home' } }
    });
    expect((await takeNext(bench.agent('agent-1'), 'es-launch', undefined)).taken).toBeUndefined();

    for (const [name, task, file] of [
      ['agent-1', 't-home', 'src/space/pages/home/hero.ts'],
      ['agent-2', 't-menu', 'src/space/pages/menu.ts']
    ] as const) {
      const held = bench.agent(name, { token: String((name === 'agent-1' ? first : second).taken?.token) });
      await writeInCopy(String((name === 'agent-1' ? first : second).taken?.work), file, 'export const done = true;\n');
      await completeTask(held, 'es-launch', task);
      await reviewTask(lead(), 'es-launch', task, 'approve', []);
    }
    await doTask('agent-3', 't-about', 'src/space/pages/about.ts', 'export const about = { done: true };\n');
    await doTask('agent-3', 't-book', 'src/space/pages/book.ts', 'export const book = { done: true };\n');

    expect(await nextTask(bench.agent('agent-1'), 'es-launch')).toMatchObject({
      finished: true,
      worked: [{ task: 't-home', status: 'done' }]
    });
  });

  it('lets the lead write the run into the project only when a person allowed it — at its open or since', async () => {
    await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    expect((await finishRun(lead(), 'es-launch', { apply: false, leavePending: true })).leadFinishes).toBe(false);
    expect((await refusal(finishRun(lead(), 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'person-only'
    );
    // The lead cannot give itself the project: a person allows it, in their terminal.
    expect((await refusal(allowLeadFinish(lead(), 'es-launch'))).code).toBe('person-only');

    expect(await allowLeadFinish(bench.person(true), 'es-launch')).toMatchObject({ leadFinishes: true, was: false });
    const finished = await finishRun(lead(), 'es-launch', { apply: true, leavePending: true });
    expect(finished.writtenBy).toMatch(/^the lead \(lead\), as a person allowed it at /);
    expect(await fs.readFile(path.join(bench.root, 'src/space/pages/about.ts'), 'utf-8')).toContain('es: true');
    expect(await fs.readFile(String(finished.report), 'utf-8')).toContain('Written by the lead (lead), as a person');
  });

  it('asks a person at the open when the lead is to finish, and opens nothing without one', async () => {
    const file = await bench.writePlan(benchPlan());
    expect((await refusal(openWith(lead(), file, 4, { leadFinishes: true }))).code).toBe('person-only');
    await expect(fs.stat(runPaths(bench.root, 'es-launch').dir)).rejects.toThrow();

    await openWith(bench.person(true), file, 4, { leadFinishes: true });
    expect((await loadRun(lead(), 'es-launch')).record.leadFinishes).toEqual(expect.any(String));
    await allowLeadFinish(bench.person(true), 'es-launch', { revoke: true });
    expect((await loadRun(lead(), 'es-launch')).record.leadFinishes).toBeUndefined();
  });

  it('watches a file a task makes too long: the lead told once, the agent with its heartbeat, the complete held', async () => {
    const lines = (count: number): string =>
      Array.from({ length: count }, (_, index) => `export const line${String(index)} = ${String(index)};`).join('\n');
    await bench.write('src/space/pages/menu.ts', `${lines(410)}\n`);
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', `${lines(420)}\n`);

    const signal = await reportProgress(home.ctx, 'es-launch', 't-home', {});
    expect(signal.longFiles).toEqual([{ file: 'src/space/pages/home/hero.ts', lines: 420, before: 1 }]);
    const woken = await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 });
    expect(woken.fresh.map(item => item.text)).toContain(
      't-home: src/space/pages/home/hero.ts is 420 non-blank lines (more than 400; 1 in the project) — ask it to split it now, by what changes together (plitzi task message t-home "…")'
    );
    // Longer still, it is the same notice: the lead is not woken again for every line written.
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', `${lines(430)}\n`);
    expect((await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).fresh).toEqual([]);

    const refused = await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect([refused.code, refused.message]).toEqual([
      'checks-failed',
      expect.stringContaining('leaves files too long to read whole: src/space/pages/home/hero.ts is 430') as unknown
    ]);

    // Split, it completes; a file already past the line that a task makes longer is said, not refused.
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    const menu = await take('agent-2', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', `${lines(415)}\n`);
    expect((await reportProgress(menu.ctx, 'es-launch', 't-menu', {})).longFiles).toEqual([
      { file: 'src/space/pages/menu.ts', lines: 415, before: 410 }
    ]);
    await completeTask(menu.ctx, 'es-launch', 't-menu');
  });

  it('takes a task nobody took out of the run — never one taken, nor one others wait for', async () => {
    await open(benchPlan());
    await take('agent-1', 't-home');

    const without = (ids: string[]) => {
      const plan = benchPlan();
      plan.tasks = plan.tasks.filter(task => !ids.includes(task.id));

      return bench.writePlan(plan);
    };
    const taken = await refusal(amendRun(lead(), 'es-launch', await without(['t-home'])));
    expect(taken.message).toContain('"t-home" is in-progress, agent-1');
    expect(taken.message).toContain('"t-home" is what "t-book" waits for');
    const waited = await refusal(amendRun(lead(), 'es-launch', await without(['t-menu'])));
    expect(waited.message).toContain('"t-menu" is what "t-book" waits for');

    expect(await amendRun(lead(), 'es-launch', await without(['t-book']))).toMatchObject({ removed: ['t-book'] });
    const run = await loadRun(lead(), 'es-launch');
    expect(run.tasks.map(task => task.id)).not.toContain('t-book');
    expect(run.plan.tasks.map(task => task.id)).not.toContain('t-book');
  });

  it('lets the lead amend what an open run asks — told to the task — but never its shape, nor a task done', async () => {
    const plan = benchPlan();
    await open(plan);
    const home = await take('agent-1', 't-home');
    await doTask(
      'agent-2',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: ${JSON.stringify('Sobre')} };\n`
    );

    const amended = benchPlan();
    amended.tasks[0].acceptance = [{ said: 'The hero says Hola', check: 'grep -q Hola src/space/pages/home/hero.ts' }];
    amended.notes = ['Spanish of Spain'];
    const file = await bench.writePlan(amended);
    expect(await amendRun(lead(), 'es-launch', file)).toMatchObject({
      tasks: [{ task: 't-home', changed: ['acceptance'] }],
      notes: ['Spanish of Spain']
    });
    expect((await taskContext(home.ctx, 'es-launch', 't-home')).task.acceptance).toEqual(amended.tasks[0].acceptance);
    const told = (await reportProgress(home.ctx, 'es-launch', 't-home', {})).messages.map(message => message.text);
    expect(told).toEqual([expect.stringContaining('The hero says Hola'), 'Spanish of Spain']);

    const reshaped = benchPlan();
    reshaped.tasks[1].files = ['src/space/pages/book.ts'];
    reshaped.tasks[3].title = 'About, again';
    const refused = await refusal(amendRun(lead(), 'es-launch', await bench.writePlan(reshaped)));
    expect(refused.message).toContain('"t-menu": its files are the run');
    expect(refused.message).toContain('"t-about" is done');

    // Who a task is for changes until it is taken.
    const recast = benchPlan();
    recast.tasks[0].role = 'designer';
    const taken = await refusal(amendRun(lead(), 'es-launch', await bench.writePlan(recast)));
    expect(taken.message).toContain('"t-home" is in-progress: its role are what an agent took it as');
    recast.tasks[0].role = amended.tasks[0].role;
    recast.tasks[0].acceptance = amended.tasks[0].acceptance;
    recast.tasks[1].role = 'designer';
    recast.tasks[1].quality = 'high';
    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(recast))).toMatchObject({
      tasks: [{ task: 't-menu', changed: ['role', 'quality'] }]
    });
    expect((await taskContext(lead(), 'es-launch', 't-menu')).task).toMatchObject({
      role: 'designer',
      quality: 'high'
    });

    const again = await refusal(amendRun(lead(), 'es-launch', await bench.writePlan(recast)));
    expect(again.message).toContain('asks nothing the run does not');
  });
});
