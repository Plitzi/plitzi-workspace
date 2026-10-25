import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { waitForLead } from './leadWatch';
import { abortRun } from './merge';
import { startTaskPreview } from './preview';
import { resumeRun, stopRun } from './run';
import { showTask, showTaskFile } from './show';
import { askLead, messageTasks, noteRun, readInbox, tellLead } from './talk';
import {
  blockTask,
  completeTask,
  followNext,
  nextTask,
  reportProgress,
  reviewTask,
  takeTask,
  taskContext,
  unblockTask
} from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** A team: roles, waiting for work, and the lead talking to the agents. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

describe('a team: roles, waiting for work, and a lead who talks to the agents', () => {
  // Two developers took the end of a wait for the run's, and stopped — their tasks came back to nobody.
  it('tells an agent whose task is in review not to stop when its wait ends', async () => {
    await open();
    // Its agents designers too, as the team says: a role of no task of the plan is still one it may ask work of.
    // One session each, the test's: a fresh start between tasks is no stop for want of work (`runs-fresh-context`).
    await bench.writeTeam({
      version: 1,
      agents: [{ name: 'agent', roles: ['developer', 'designer'], count: 4, session: 'keep' }]
    });
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, 'es-launch', 't-menu');

    // Nothing of its role left for others, and still not done: what it sent may come back.
    expect((await nextTask(bench.agent('agent-1'), 'es-launch', 'designer')).finished).toBeUndefined();
    // Nothing ready for it a while: the wait ends — saying its task in review is why not to stop.
    await take('agent-2', 't-home');
    await take('agent-3', 't-about');
    const waited = await followNext(bench.agent('agent-1'), 'es-launch', 'developer', { timeoutMs: 30, everyMs: 10 });
    expect(waited.timedOut).toBe(true);
    expect(waited.why).toContain('Your wait ended, not your work: run the same command again');
    expect(waited.why).toContain('t-menu, yours, is in review, and comes back to you if sent back');
  });

  it('gives each role its tasks: next picks for the role, and take refuses another role’s', async () => {
    const plan = benchPlan();
    plan.tasks[1].role = 'designer';
    await open(plan);

    expect((await nextTask(lead(), 'es-launch', 'designer')).task?.id).toBe('t-menu');
    expect((await nextTask(lead(), 'es-launch', 'writer')).why).toContain('no task in this run is a writer');
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
    // Every task of its roles done: of the team's base, it waits for what the lead may stack, never told to stop.
    const idle = await nextTask(bench.agent('agent-2'), 'es-launch', 'designer');
    expect(idle.finished).toBeUndefined();
    expect(idle.why).toContain("you are of the team's base");
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
    await tellLead(home.ctx, 'es-launch', 't-home', 'The hero keeps its id');
    await completeTask(home.ctx, 'es-launch', 't-home');

    const shown = await showTask(lead(), 'es-launch', 't-home');
    // What it told, read here, is not handed over again; the question waits for its answer.
    expect((await readInbox(lead(), 'es-launch')).map(message => message.text)).toEqual(['Formal or informal?']);
    expect([shown.status, shown.from, shown.checks, shown.holder]).toEqual([
      'in-review',
      'submitted',
      'passed',
      'agent-1'
    ]);
    expect(shown.files).toMatchObject([{ file: 'src/space/pages/home/hero.ts', change: 'changed' }]);
    expect(shown.files[0].diff).toMatch(/^\+export const hero = \{"text":"Hola"\};$/m);
    expect(shown.messages.map(message => message.text)).toEqual(['Formal or informal?', 'The hero keeps its id']);
    expect(shown.next.join('\n')).toContain('plitzi task review t-home --approve');
    // Its holder reads its own, as the lead does (a run's dev-2, refused its own) — and another's, read only
    // (three agents diffed blobs by hash to read what a request asked).
    expect((await showTask(home.ctx, 'es-launch', 't-home')).task.id).toBe('t-home');
    expect((await showTask(home.ctx, 'es-launch', 't-menu')).task.id).toBe('t-menu');
  });

  // Past a diff's 80 lines, or around a change: the file whole, as it went to review — while its copy goes on.
  it('shows one file of a task whole, as it went to review, and refuses a file it did not change', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "later" };\n');

    expect(await showTaskFile(lead(), 'es-launch', 't-home', './src/space/pages/home/hero.ts')).toEqual({
      task: 't-home',
      file: 'src/space/pages/home/hero.ts',
      from: 'submitted',
      change: 'changed',
      text: 'export const hero = { text: "Hola" };\n',
      // Its own change, from where its work started: never what another task had approved since.
      diff: expect.stringContaining('+export const hero = { text: "Hola" };') as unknown
    });
    const refused = await refusal(showTaskFile(lead(), 'es-launch', 't-home', 'src/main.ts'));
    expect([refused.code, refused.message]).toEqual([
      'not-found',
      't-home did not change src/main.ts: its changed files are src/space/pages/home/hero.ts'
    ]);
  });

  it('the lead looks at a task in review in its copy, served until it is neither worked nor in review', async () => {
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
    // A copy is served while it is worked or in review: one nobody took has none.
    expect((await refusal(startTaskPreview(lead(), 'es-launch', 't-menu', 18_391))).code).toBe('invalid');

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
    // Handed back with what was said to the task meanwhile — the answer — and not again with its next sign of life.
    expect(next).toMatchObject({ yours: 'in-progress', task: { id: 't-home' } });
    expect(next.messages.map(each => each.text)).toEqual(['Monday to Friday, 9 to 17 UTC']);
    expect((await nextTask(bench.agent('agent-2'), 'es-launch')).task?.id).not.toBe('t-home');
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).messages).toEqual([]);
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

  it('the run’s notes reach every task: in hand with its next sign of life, taken later with its take', async () => {
    const plan = benchPlan();
    plan.notes = ['A template’s now answers nothing in the published packages: use lib/today.ts'];
    await open(plan);
    const home = await take('agent-1', 't-home');
    expect(home.messages.map(message => message.text)).toEqual([plan.notes[0]]);

    await noteRun(lead(), 'es-launch', 'Prices in euros, two decimals');
    expect((await reportProgress(home.ctx, 'es-launch', 't-home', {})).messages.map(message => message.text)).toEqual([
      'Prices in euros, two decimals'
    ]);
    const menu = await take('agent-2', 't-menu');
    expect(menu.messages.map(message => message.text)).toEqual([plan.notes[0], 'Prices in euros, two decimals']);
    expect((await taskContext(menu.ctx, 'es-launch', 't-menu')).runNotes).toHaveLength(2);
  });
});
