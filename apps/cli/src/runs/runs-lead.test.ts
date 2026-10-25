import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { extendRun } from './extend';
import { waitForLead } from './leadWatch';
import { finishRun } from './merge';
import { monitorRun } from './monitor';
import { readOwnership } from './ownership';
import { runPaths } from './paths';
import { checkPlan } from './plan';
import { allowLeadFinish, loadRun, readRunLog } from './run';
import { tellLead } from './talk';
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
import { runsState, viewRun } from './view';
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

  // T-motion waited for t-boxer's third round though it shared no file with it — and amend refused to let
  // it start: what a task waits for was the run's shape.
  it('lets the lead change what a task nobody took waits for — never into a circle', async () => {
    const plan = benchPlan();
    await open(plan);
    const book = plan.tasks.find(task => task.dependsOn.length > 1);
    if (!book) {
      throw new Error('the bench plan has a task after two');
    }

    const sooner = {
      ...plan,
      tasks: plan.tasks.map(task => (task.id === book.id ? { ...task, dependsOn: [book.dependsOn[0]] } : task))
    };
    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(sooner))).toMatchObject({
      tasks: [{ task: book.id, changed: ['dependsOn'] }]
    });
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === book.id)?.waitsOn).toEqual([
      book.dependsOn[0]
    ]);

    const circle = {
      ...sooner,
      tasks: sooner.tasks.map(task => (task.id === book.dependsOn[0] ? { ...task, dependsOn: [book.id] } : task))
    };
    expect((await refusal(amendRun(lead(), 'es-launch', await bench.writePlan(circle)))).message).toContain(
      'would wait for itself'
    );
  });

  it('paces a plan by how this project’s runs went: their middle done task’s minutes over its estimate', async () => {
    const task = (id: string, minutes: number, estimateMinutes: number) => ({
      id,
      status: 'done',
      minutes,
      estimateMinutes
    });
    const tasks = [task('a', 5, 20), task('b', 10, 20), task('c', 5, 20), task('d', 10, 20), task('e', 10, 20)];
    await bench.write(
      '.plitzi/plitzi-reports/runs/old-run/report.json',
      JSON.stringify({ version: 1, report: { at: '2026-10-20T00:00:00.000Z', tasks } })
    );

    const checked = await checkPlan(bench.root, benchPlan(), await readOwnership(bench.root), teamFor(benchPlan(), 2));
    // A quarter, half, a quarter, half, half: the middle one is half.
    expect(checked.estimate.paced).toEqual({
      from: 'project',
      ratio: 0.5,
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

  // T-close-home named src/space/pages/home while t-home-top, in review, still had files to put there.
  it('refuses a stage task naming a folder a task at work writes in, unless it waits for it', async () => {
    const plan = benchPlan();
    plan.tasks[1].files = ['src/space/pages/menu.ts', 'src/space/pages/carta/list.ts'];
    await open(plan);
    await take('agent-2', 't-menu');
    const tidy = {
      id: 't-tidy',
      title: 'One module of the menu’s styles',
      files: ['src/space/pages/carta'],
      dependsOn: [],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: ['One styles module']
    };
    const stage = (dependsOn: string[]): RunPlan => ({
      version: 1,
      runId: 'es-stage-tidy',
      goal: 'Tidy',
      tasks: [{ ...tidy, dependsOn }]
    });

    const refused = await refusal(extendRun(lead(), 'es-launch', await bench.writePlan(stage([]))));
    expect(refused.message).toContain(
      'src/space/pages/carta/list.ts — in a folder it names — is "t-menu"\'s, still at work'
    );
    await extendRun(lead(), 'es-launch', await bench.writePlan(stage(['t-menu'])));
  });

  it('says in its activity what each agent is at between tasks, and ends saying the run is ready', async () => {
    await open();
    const log = async () => readRunLog((await loadRun(lead(), 'es-launch')).paths);
    // Every task ready but one, and it waits on two: an agent with nothing it can take waits — once, said once: the wait
    // run again after its timeout, for the same reason, is the same wait.
    const held = {
      't-home': await take('agent-1', 't-home'),
      't-menu': await take('agent-2', 't-menu'),
      't-about': await take('agent-3', 't-about')
    };
    await takeNext(bench.agent('agent-4'), 'es-launch', 'developer', { timeoutMs: 30, everyMs: 10 });
    await takeNext(bench.agent('agent-4'), 'es-launch', 'developer', { timeoutMs: 30, everyMs: 10 });
    const waited = (await log()).filter(entry => entry.by === 'agent-4').map(entry => entry.action);
    expect(waited.filter(action => action === 'waiting')).toHaveLength(1);
    expect(waited).not.toContain('idle');

    const pages = {
      't-home': 'src/space/pages/home/hero.ts',
      't-menu': 'src/space/pages/menu.ts',
      't-about': 'src/space/pages/about.ts'
    } as const;
    for (const task of ['t-home', 't-menu', 't-about'] as const) {
      await writeInCopy(held[task].work, pages[task], `export const page = ${JSON.stringify(task)};\n`);
      await completeTask(held[task].ctx, 'es-launch', task);
      await reviewTask(lead(), 'es-launch', task, 'approve', []);
    }

    // The approval is written the moment it is made, and what it let go after it: an approval whose next steps failed
    // was in the run's work and nowhere in the log.
    const menu = (await log()).filter(entry => entry.task === 't-menu' && entry.by === 'lead');
    expect(menu.map(entry => entry.action)).toEqual(['review', 'handed-on']);
    expect(menu[1]).toMatchObject({ granted: [], ready: ['t-book'] });

    await doTask('agent-4', 't-book', 'src/space/pages/book.ts', 'export const book = {};\n');

    expect((await log()).at(-1)).toMatchObject({ action: 'all-approved', tasks: 4 });
    // Of the team's base, it waits while the run is open: the lead may stack another stage.
    const idle = await nextTask(bench.agent('agent-4'), 'es-launch', 'developer');
    expect(idle.finished).toBeUndefined();
    expect(idle.why).toContain("you are of the team's base");
    // Design-1 waited 4.5 h told only to wait — the run waited for the person's apply.
    expect(idle.why).toContain("it waits for its finish — the lead's summary, then a person's apply");
    expect((await log()).filter(entry => entry.by === 'agent-4').map(entry => entry.action)).not.toContain('stops');
    await finishRun(lead(), 'es-launch', { apply: false, leavePending: true });
    expect((await log()).at(-1)).toMatchObject({
      action: 'ready',
      next: expect.stringContaining('--apply') as unknown
    });
    // Every task approved: no agent waits or idles on the monitor, whatever it said last (agent-4 waited before).
    const agents = (await monitorRun(lead(), 'es-launch')).agents.filter(agent => agent.kind === 'agent');
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.map(agent => [agent.status, agent.doing])).toEqual(
      agents.map(() => ['stopped', 'every task approved — nothing is left for it'])
    );
  });

  it('reads a stage against the run’s work: a file the run made is no file to make', async () => {
    const plan = benchPlan();
    const about = plan.tasks.find(task => task.id === 't-about');
    about?.files.push('src/space/pages/team.ts', 'src/plugins/Badge');
    await open(plan);
    const held = await take('agent-1', 't-about');
    await writeInCopy(held.work, 'src/space/pages/team.ts', 'export const team = {};\n');
    await writeInCopy(held.work, 'src/plugins/Badge/index.ts', 'export const badge = {};\n');
    await completeTask(held.ctx, 'es-launch', 't-about');
    await reviewTask(lead(), 'es-launch', 't-about', 'approve', []);
    const stage: RunPlan = {
      version: 1,
      runId: 'es-stage-2',
      goal: 'Contact page',
      tasks: [
        {
          id: 't-contact',
          title: 'A contact page',
          files: ['src/space/pages/contact.ts', 'src/space/pages/team.ts', 'src/plugins/Badge'],
          dependsOn: [],
          priority: 'medium',
          estimateMinutes: 10,
          acceptance: ['There is a contact page']
        }
      ]
    };

    const dry = await extendRun(lead(), 'es-launch', await bench.writePlan(stage), { dryRun: true });
    expect(dry.checked?.created).toEqual(['src/space/pages/contact.ts']);
  });

  // The scope's four tasks were refused for a runId and a goal — the run had both.
  it('takes a stage of tasks alone: its name and its goal are the run’s', async () => {
    await open();
    await bench.write(
      'stage.json',
      JSON.stringify({
        tasks: [
          {
            id: 't-contact',
            title: 'A contact page',
            files: ['src/space/pages/contact.ts'],
            dependsOn: [],
            priority: 'medium',
            estimateMinutes: 10,
            acceptance: ['There is a contact page']
          }
        ]
      })
    );

    const stacked = await extendRun(lead(), 'es-launch', path.join(bench.root, 'stage.json'));
    expect(stacked).toMatchObject({ added: ['t-contact'] });
  });

  it('takes up a piece the run left out once a stage proves it: no longer waiting, said', async () => {
    const plan = benchPlan();
    plan.inventory = [
      { id: 'contact-form', piece: 'the contact form', page: '/contact', leftOut: 'a stage of its own' }
    ];
    await open(plan);

    const stage: RunPlan = {
      version: 1,
      runId: 'es-stage-2',
      goal: 'Contact page',
      tasks: [
        {
          id: 't-contact',
          title: 'A contact page',
          files: ['src/space/pages/contact.ts'],
          dependsOn: [],
          priority: 'medium',
          estimateMinutes: 10,
          acceptance: [{ said: 'The form is there', check: 'true', covers: ['contact-form'] }]
        }
      ]
    };
    expect(await extendRun(lead(), 'es-launch', await bench.writePlan(stage))).toMatchObject({
      takenUp: ['contact-form']
    });
    expect((await loadRun(lead(), 'es-launch')).plan.inventory).toEqual([
      { id: 'contact-form', piece: 'the contact form', page: '/contact' }
    ]);
  });

  it('lists the runs waiting to be written into the project, the ready ones first, with what applies each', async () => {
    await open();
    expect(await runsState(lead())).toMatchObject([{ runId: 'es-launch', ready: false, done: 0, total: 4 }]);
    for (const [task, file] of [
      ['t-home', 'src/space/pages/home/hero.ts'],
      ['t-menu', 'src/space/pages/menu.ts'],
      ['t-about', 'src/space/pages/about.ts'],
      ['t-book', 'src/space/pages/book.ts']
    ] as const) {
      await doTask('agent-1', task, file, 'export const done = true;\n');
    }

    expect(await runsState(lead())).toMatchObject([
      { runId: 'es-launch', ready: true, leadFinishes: false, apply: 'npx plitzi run finish es-launch --apply' }
    ]);
  });

  // Carlos: what the lead looked at is gone from what needs it — a note only to know, shown whole, is read.
  it('shows a note only to know whole in the watch, and reads it: it needs the lead no more', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const note = `The hero now reads in Spanish. ${'And more. '.repeat(40)}`;
    await tellLead(home.ctx, 'es-launch', 't-home', note);

    const woke = await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 });
    expect(woke.fresh.map(item => item.text)).toContainEqual(expect.stringContaining(note.trim()));
    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'message')).toBe(false);
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

    // Nothing left for it: it hears how its own work ended, and waits, of the team's base, while the run is open.
    expect(await nextTask(bench.agent('agent-1'), 'es-launch')).toMatchObject({
      why: expect.stringContaining("you are of the team's base") as unknown,
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
    expect(await fs.readFile(path.join(finished.report?.dir ?? '', 'report.md'), 'utf-8')).toContain(
      'Written by the lead (lead), as a person'
    );
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

  it('watches a file a task makes too long: the agent told with its heartbeat, the complete held, the lead never woken', async () => {
    const lines = (count: number): string =>
      Array.from({ length: count }, (_, index) => `export const line${String(index)} = ${String(index)};`).join('\n');
    await bench.write('src/space/pages/menu.ts', `${lines(410)}\n`);
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', `${lines(420)}\n`);

    const signal = await reportProgress(home.ctx, 'es-launch', 't-home', {});
    expect(signal.longFiles).toEqual([{ file: 'src/space/pages/home/hero.ts', lines: 420, before: 1 }]);
    // The agent's to hear, never the lead's to relay: a run's relayed message arrived after the split.
    expect((await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).fresh).toEqual([]);
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', `${lines(430)}\n`);

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

// A page-weight bound of the lead's, too tight once other tasks reached every page, held the finish — its
// task done, the line could not be amended; and amending stages dropped s-scope, then a stage left out of a joined plan.
describe('amending a run with stages and done tasks', () => {
  const stage = (runId: string, id: string, file: string): RunPlan => ({
    version: 1,
    runId,
    goal: `The ${id} page`,
    tasks: [
      {
        id,
        title: `A ${id} page`,
        files: [file],
        dependsOn: [],
        priority: 'medium',
        estimateMinutes: 10,
        acceptance: [`There is a ${id} page`]
      }
    ]
  });

  /** A plan written under a name of its own: a stage saying the run's id would take the run's file otherwise. */
  const planFile = async (plan: RunPlan, name: string): Promise<string> => {
    await bench.write(name, JSON.stringify(plan));

    return path.join(bench.root, name);
  };

  it('amends a done task’s acceptance alone — held again at the finish — and nothing else it was asked', async () => {
    await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');

    const wrong = benchPlan();
    wrong.tasks[3].acceptance = [{ said: 'About says hola', check: 'grep -q hola src/space/pages/about.ts' }];
    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(wrong))).toMatchObject({
      tasks: [{ task: 't-about', changed: ['acceptance'], done: true }]
    });
    const held = await refusal(finishRun(lead(), 'es-launch', { apply: false, leavePending: true }));
    expect([held.code, held.message]).toEqual(['checks-failed', expect.stringContaining('About says hola') as unknown]);

    const right = benchPlan();
    right.tasks[3].acceptance = [{ said: 'About is in Spanish', check: 'grep -q es src/space/pages/about.ts' }];
    await amendRun(lead(), 'es-launch', await bench.writePlan(right));
    await finishRun(lead(), 'es-launch', { apply: false, leavePending: true });

    right.tasks[3].title = 'About, again';
    expect((await refusal(amendRun(lead(), 'es-launch', await bench.writePlan(right)))).message).toContain(
      '"t-about" is done: its title was held already — only its acceptance'
    );
  });

  it('names a stage that says the run’s own name, and amends each plan for its own tasks alone', async () => {
    await open();
    const contact = stage('es-launch', 't-contact', 'src/space/pages/contact.ts');
    await extendRun(lead(), 'es-launch', await planFile(contact, 'contact.plan.json'));
    await extendRun(
      lead(),
      'es-launch',
      await planFile(stage('es-faq', 't-faq', 'src/space/pages/faq.ts'), 'faq.plan.json')
    );
    const stacked = (await readRunLog((await loadRun(lead(), 'es-launch')).paths)).filter(
      entry => entry.action === 'extend'
    );
    expect(stacked.map(entry => entry.stage)).toEqual(['es-launch-stage-4', 'es-faq']);

    // A stage's plan as it was stacked amends its task, and no task of the plans it does not hold leaves.
    contact.tasks[0].title = 'A contact page, with the map';
    expect(await amendRun(lead(), 'es-launch', await planFile(contact, 'contact.plan.json'))).toMatchObject({
      tasks: [{ task: 't-contact', changed: ['title'] }]
    });
    // The run's plan joined by hand without the faq's stage keeps the faq's task.
    const joined = benchPlan();
    joined.tasks.push(...contact.tasks);
    joined.notes = ['Formal Spanish'];
    const amended = await amendRun(lead(), 'es-launch', await bench.writePlan(joined));
    expect(amended.removed).toBeUndefined();
    const run = await loadRun(lead(), 'es-launch');
    expect(run.tasks.map(task => task.id)).toEqual(expect.arrayContaining(['t-contact', 't-faq']));
    expect(run.plan.tasks.map(task => task.id)).toEqual(expect.arrayContaining(['t-contact', 't-faq']));
  });

  it('runs a stage’s lines once on the run’s work before stacking it, each said for what it is', async () => {
    await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const next = stage('es-next', 't-contact', 'src/space/pages/contact.ts');
    next.tasks[0].acceptance = [
      { said: 'About stays Spanish', check: 'grep -q es src/space/pages/about.ts' },
      { said: 'The contact page exists', check: 'test -f src/space/pages/contact.ts' }
    ];
    const dry = await extendRun(lead(), 'es-launch', await planFile(next, 'next.plan.json'), {
      dryRun: true,
      lines: true
    });

    expect(dry.tried).toEqual([
      { task: 't-contact', said: 'About stays Spanish', verdict: 'passes' },
      { task: 't-contact', said: 'The contact page exists', verdict: 'value' }
    ]);
    expect((await loadRun(lead(), 'es-launch')).tasks.map(task => task.id)).not.toContain('t-contact');
  });
});
