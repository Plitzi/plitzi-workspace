import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { finishRun } from './merge';
import { readOwnership } from './ownership';
import { checkPlan } from './plan';
import { syncPreview } from './preview';
import { loadRun } from './run';
import { showTask } from './show';
import { askLead, messageTasks, readInbox, tellLead } from './talk';
import { completeTask, nextTask, reportProgress, revertTask, taskContext } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** A task held to its acceptance and its checks — and what the run leaves behind. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

describe('acceptance, checks and what is left behind', () => {
  it('refuses a page check whose text the shell would split into a page', async () => {
    const plan = benchPlan();
    plan.tasks[0].acceptance = [
      { said: 'Split', check: 'plitzi page check /digest --url $PLITZI_URL --expect digest-title~This week' },
      {
        said: 'Quoted',
        check: 'plitzi page check /digest --url $PLITZI_URL --expect "digest-title~This week" && echo ok'
      }
    ];

    const refusedPlan = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4)).catch(
      (error: unknown) => error
    );
    const said = (refusedPlan as { problems: string[] }).problems.join('\n');
    expect(said).toContain('hands page check "week" as a page');
    expect(said).not.toContain('"Quoted" hands');
  });

  it('holds a task to its acceptance by the checks its plan gives: unmet, the complete is refused; met, the lead sees it', async () => {
    const plan = benchPlan();
    plan.tasks[0].acceptance = [
      'Home reads in Spanish',
      { said: 'The hero says Hola', check: 'grep -q Hola src/space/pages/home/hero.ts' }
    ];
    await open(plan);
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');

    const refused = await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    expect([refused.code, refused.message]).toEqual([
      'checks-failed',
      expect.stringContaining('"The hero says Hola"') as unknown
    ]);

    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = ${JSON.stringify({ text: 'Hola' })};\n`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    expect((await showTask(lead(), 'es-launch', 't-home')).accepted).toEqual([
      { said: 'The hero says Hola', check: 'grep -q Hola src/space/pages/home/hero.ts', ok: true }
    ]);
  });

  it('serves the copy for a check that names $PLITZI_URL, and stops it after', async () => {
    const answer = 'served copy';
    await bench.write(
      'serve.mjs',
      `import http from 'node:http';\n\nhttp.createServer((q, r) => r.end('${answer}')).listen(process.env.PORT);\n`
    );
    await bench.write(
      'package.json',
      `${JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { start: 'node serve.mjs' } })}\n`
    );
    await bench.write(
      'check.mjs',
      `const text = await (await fetch(process.env.PLITZI_URL)).text();\nprocess.exit(text === '${answer}' ? 0 : 1);\n`
    );
    const plan = benchPlan();
    plan.tasks[0].acceptance = [{ said: 'The copy answers', check: 'node check.mjs $PLITZI_URL' }];
    await open(plan);
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');

    await completeTask(home.ctx, 'es-launch', 't-home');
    expect((await showTask(lead(), 'es-launch', 't-home')).accepted?.[0]?.ok).toBe(true);
  }, 30_000);

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
    const reading = await checkPlan(bench.root, theme, await readOwnership(bench.root), teamFor(theme, 3));
    expect(reading.tasks[0].files).toEqual(['src/space/theme.ts']);
    expect(
      reading.notices.some(
        notice =>
          notice.startsWith('src/space/theme.ts (t-home) is read by') && notice.includes('src/space/pages/menu.ts')
      )
    ).toBe(true);
  });
});
