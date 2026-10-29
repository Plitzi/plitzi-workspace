import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { finishRun } from './merge';
import { readOwnership } from './ownership';
import { syncPreview } from './preview';
import { LINT_CACHE_FILE } from '../../scaffold/paths';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { checkPlan } from '../plan/plan';
import { loadRun, readRunLog } from '../run';
import { askLead, messageTasks, readInbox, tellLead } from '../talk/talk';
import { checkTask, completeTask, nextTask, reportProgress, revertTask, reviewTask, taskContext } from '../tasks';
import { showTask } from '../view/show';
import { viewRun } from '../view/view';

import type { CheckRunner } from './checks';
import type { Bench } from '../../tests/runProject';
import type { Message } from '../talk/messages';

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
  it('leaves a note of a task approved since out of what needs the lead: it is the inbox’s history', async () => {
    const runId = await open();
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await tellLead(menu.ctx, runId, 't-menu', 'Prices come from menu.json');
    await completeTask(menu.ctx, runId, 't-menu');
    expect((await viewRun(lead(), runId)).attention.some(item => item.text.includes('for you to know'))).toBe(true);

    await reviewTask(lead(), runId, 't-menu', 'approve', []);
    expect((await viewRun(lead(), runId)).attention.some(item => item.text.includes('for you to know'))).toBe(false);
    expect((await readInbox(lead(), runId)).map(message => message.text)).toContain('Prices come from menu.json');
  });

  // Ten warnings in files the run's tasks changed, each said at complete and none fixed — and later, tasks renamed ids
  // an acceptance read and handed back a one-value change to a long file, to clear warnings older than them.
  it('refuses a warning of the space’s lint a completion adds — and keeps one its file had before for the backlog', async () => {
    // The space's lint, as the bench reads it: a warning in each file holding WARN, on the line it is.
    const lint: CheckRunner = async dir => {
      const warnings: string[] = [];
      for (const file of ['src/space/pages/menu.ts', 'src/space/pages/about.ts']) {
        const lines = (await fs.readFile(path.join(dir, file), 'utf-8').catch(() => '')).split('\n');
        lines.forEach((line, index) => {
          if (line.includes('WARN')) {
            warnings.push(`${file}:${String(index + 1)} colour-not-token`);
          }
        });
      }

      return { ok: true, steps: [{ name: 'lint:space', ok: true, ...(warnings.length > 0 ? { warnings } : {}) }] };
    };
    await bench.write('src/space/pages/menu.ts', 'export const menu = { title: "Menu" }; // WARN\n');
    const runId = await open();
    const menu = await take('agent-1', 't-menu');
    const linted = { ...menu.ctx, checks: lint };
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      'export const tag = "new"; // WARN\nexport const menu = { title: "Menú" }; // WARN\n'
    );

    const refused = await refusal(completeTask(linted, runId, 't-menu'));
    expect(refused.code).toBe('checks-failed');
    expect(refused.message).toContain('adds warnings');
    expect(refused.message).toContain('src/space/pages/menu.ts:2 colour-not-token');
    expect(refused.message).not.toContain('menu.ts:1 colour-not-token;');

    // Its own fixed — the one older than it, moved a line down by its edit, left: kept for the backlog, not refused.
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      'export const tag = "new";\nexport const menu = { title: "Menú" }; // WARN\n'
    );
    const completed = await completeTask(linted, runId, 't-menu');
    expect(completed.olderWarnings).toEqual(['src/space/pages/menu.ts:2 colour-not-token']);
    expect((await viewRun(lead(), runId)).tasks.find(task => task.id === 't-menu')?.status).toBe('in-review');
    const kept = (await readRunLog((await loadRun(lead(), runId)).paths)).filter(entry => entry.action === 'notice');
    expect(kept.map(entry => entry.text)).toEqual([
      "The space's lint warns src/space/pages/menu.ts:2 colour-not-token — there before this run's change to the file: the project's to fix"
    ]);
  });

  // A run's dev-2 ran two checks of one copy at once: the second met the first's server, was told to stop "a server of
  // your own", and broke the first. They run one after another, the second saying it waits.
  it('runs two checks of one copy one after the other, the second saying it waits', async () => {
    const runId = await open();
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    let running = 0;
    let most = 0;
    const slow: CheckRunner = async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise(resolve => setTimeout(resolve, 150));
      running -= 1;

      return { ok: true, steps: [{ name: 'lint', ok: true }] };
    };
    const said: string[] = [];
    const ctx = { ...menu.ctx, checks: slow, say: (line: string) => said.push(line) };

    await Promise.all([
      checkTask(ctx, runId, 't-menu', { fresh: true }),
      checkTask(ctx, runId, 't-menu', { fresh: true })
    ]);
    expect(most).toBe(1);
    expect(said.some(line => line.startsWith('another check of this copy is running'))).toBe(true);
  });

  it('refuses a page check whose text the shell would split into a page', async () => {
    const plan = benchPlan();
    plan.tasks[0].acceptance = [
      { said: 'Split', check: 'plitzi page check /digest --url $PLITZI_URL --expect digest-title~This week' },
      {
        said: 'Quoted',
        check: 'plitzi page check /digest --url $PLITZI_URL --expect "digest-title~This week" && echo ok'
      },
      // A redirection is the shell's: no page.
      {
        said: 'Redirected',
        check: 'plitzi page check / --url $PLITZI_URL --hover cta 2>&1 | grep -q "cta box-shadow"'
      },
      { said: 'Spaced', check: 'plitzi page check / --url $PLITZI_URL > tmp/out.txt 2> /dev/null' }
    ];

    const refusedPlan = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 4)).catch(
      (error: unknown) => error
    );
    const said = (refusedPlan as { problems: string[] }).problems.join('\n');
    expect(said).toContain('hands page check "week" as a page');
    expect(said).not.toContain('"Quoted" hands');
    expect(said).not.toContain('"Redirected" hands');
    expect(said).not.toContain('"Spaced" hands');
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

  // 72% of its checks failed, most for the run's own breakage or a line that could never pass.
  it('a check failing for nothing of the copy’s says so, counted against nobody — a line nothing answers told once', async () => {
    const plan = benchPlan();
    plan.tasks[0].acceptance = [{ said: 'The logo', check: 'echo the original has no .logo; exit 2' }];
    await open(plan);
    await bench.write('src/space/pages/about.ts', 'export const about = BROKEN;\n');
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    // The acceptance runs though author fails: what fails is the run's too, and stops nothing of the copy's.
    expect((await checkTask(home.ctx, 'es-launch', 't-home')).notOwn).toEqual(['author', 'acceptance — The logo']);

    await bench.write('src/space/pages/about.ts', 'export const about = {};\n');
    expect((await checkTask(home.ctx, 'es-launch', 't-home')).notOwn).toEqual(['acceptance — The logo']);
    await checkTask(home.ctx, 'es-launch', 't-home', { fresh: true });
    // The lead's to amend, woken for it once — never a note it is not woken for (a run's dev-1 waited on two).
    const told = (await viewRun(lead(), 'es-launch')).attention.filter(item => item.kind === 'line-unanswered');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ task: 't-home', who: 'lead' });
    expect(told[0].text).toContain('"The logo" cannot be answered');
    expect((await refusal(completeTask(home.ctx, 'es-launch', 't-home'))).message).toContain(
      'nothing could answer it: the lead is told — not your work'
    );
  }, 30_000);

  // A type fixed in an imported file left its unchanged importers failing, read off ESLint's cache.
  it('a fresh check reads every file again: the copy’s lint cache goes with it', async () => {
    const runId = await open();
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    const cache = path.join(menu.work, LINT_CACHE_FILE);
    const passing: CheckRunner = () => Promise.resolve({ ok: true, steps: [] });
    await fs.mkdir(path.dirname(cache), { recursive: true });
    await fs.writeFile(cache, '{}');

    await checkTask({ ...menu.ctx, checks: passing }, runId, 't-menu');
    await expect(fs.readFile(cache, 'utf8')).resolves.toBe('{}');

    await checkTask({ ...menu.ctx, checks: passing }, runId, 't-menu', { fresh: true });
    await expect(fs.access(cache)).rejects.toThrow();
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

    // Silent on the step only this copy fails, a known failure is refused (t-contact's own typecheck went
    // through under one that named the shell's layout).
    expect(
      (
        await refusal(
          completeTask(home.ctx, 'es-launch', 't-home', {
            knownFailure: { why: 'the hero waits for the menu’s tokens', fixedBy: 't-book' }
          })
        )
      ).message
    ).toContain('author fails in this copy and not in the run');
    const completed = await completeTask(home.ctx, 'es-launch', 't-home', {
      knownFailure: { why: 'author: the hero waits for the menu’s tokens', fixedBy: 't-book' }
    });
    expect(completed.checks.ok).toBe(false);
    const view = await viewRun(lead(), 'es-launch');
    expect(view.attention.some(item => item.kind === 'known-failure' && item.text.includes('t-book fixes it'))).toBe(
      true
    );
    const book = await taskContext(lead(), 'es-launch', 't-book');
    expect(book.state.notes.at(-1)?.text).toContain('for you to fix');
  });

  it('what the lead says to a task with a question open answers it, --reply-to or not', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const asked = await askLead(home.ctx, 'es-launch', 't-home', 'Wait for t-menu, or go on?');
    const [told] = await messageTasks(lead(), 'es-launch', 't-home', 'Go on');

    expect(told.replyTo).toBe(asked.question.id);
    // Answered: held only until its agent has the answer.
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.asking).toMatchObject({
      answered: true
    });
    // Nothing open, nothing answered.
    expect((await messageTasks(lead(), 'es-launch', 't-home', 'And keep the hero'))[0].replyTo).toBeUndefined();
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
    // Answered once it is asked: a fixed wait was too short under the whole suite's load, and the reply named nothing.
    let question: Message | undefined;
    while (!question) {
      await new Promise(resolve => setTimeout(resolve, 10));
      question = (await readInbox(lead(), 'es-launch')).find(message => message.text === 'Anything else?');
    }

    await messageTasks(lead(), 'es-launch', 't-menu', 'No', question.id);
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

  it('removes what it was handed with the run, unless it changed since — the plan went with it from the start', async () => {
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

    // The plan was the run's from its opening, in its folder: only what was handed after is removed — or kept.
    expect(done.inputs).toEqual({ removed: [], kept: ['summary.md'], servers: [] });
    expect(await bench.read('es-launch.plan.json')).toBeUndefined();
    // A run opened and finished whole: seconds alone, past the default 5 s beside the suite under load.
  }, 30_000);

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
    await revertTask(lead(), 'es-launch', 't-about', 'not wanted after all');
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
    // One notice for every such file, each with the first that read it (twenty lines of it, twice).
    const read = reading.notices.filter(notice => notice.includes('read by files no task holds'));
    expect(read).toHaveLength(1);
    expect(read[0]).toContain('src/space/theme.ts (t-home) ← ');
    expect(read[0]).toContain('src/space/pages/book.ts, src/space/pages/home/index.ts +1');

    // A reader a task names in "touches" is followed by it: no longer one no task holds.
    const touched = benchPlan();
    touched.tasks = [
      {
        ...touched.tasks[0],
        files: ['src/space/theme.ts'],
        touches: ['src/space/pages/book.ts', 'src/space/pages/home/index.ts', 'src/space/pages/menu.ts']
      }
    ];
    const following = await checkPlan(bench.root, touched, await readOwnership(bench.root), teamFor(touched, 3));
    expect(following.notices.filter(notice => notice.includes('src/space/theme.ts (t-home) ←'))).toEqual([]);

    // A part of a page, read by the page's own index only: the index puts the parts together — no notice.
    const part = benchPlan();
    part.tasks = [{ ...part.tasks[0], files: ['src/space/pages/home/hero.ts'] }];
    const assembled = await checkPlan(bench.root, part, await readOwnership(bench.root), teamFor(part, 3));
    expect(assembled.notices.filter(notice => notice.includes('src/space/pages/home/hero.ts (t-home)'))).toEqual([]);
  });
});
