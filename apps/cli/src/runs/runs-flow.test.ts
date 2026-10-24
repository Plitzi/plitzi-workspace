import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openBacklog } from './backlog';
import { readBench } from './bench';
import { identify } from './identity';
import { finishRun } from './merge';
import { monitorRun } from './monitor';
import { noticeRun } from './notices';
import { writeSummary } from './report';
import { loadRun, openRun, readApproved, readRunLog } from './run';
import { getBlob } from './store';
import { askLead, messageTasks } from './talk';
import {
  blockTask,
  checkTask,
  claimFile,
  completeTask,
  followNext,
  nextTask,
  reportProgress,
  reviewTask,
  takeNext,
  reassignTask,
  takeTask,
  unblockTask,
  waitForFile
} from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { LEAD_SAID } from '../tests/runSteps';

import type { CheckResult, CheckRunner } from './checks';
import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

/**
 * A run played whole, agent by agent, as velada-dress went — each rule it broke now held at once: the multi-agent run is
 * the sum of its rules, and they meet where no unit test of one of them looks. Its `author` is the project's as it
 * matters here: a page reading a token (`token('x')`) its copy's theme does not declare (`declare('x')`) fails.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

/** Every file under `dir/src`, read: what the simulated `author` reads. */
const sources = async (dir: string): Promise<string[]> => {
  const files = await fs.readdir(path.join(dir, 'src'), { recursive: true, withFileTypes: true }).catch(() => []);

  return Promise.all(
    files
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
      .map(entry => fs.readFile(path.join(entry.parentPath, entry.name), 'utf-8'))
  );
};

/** `author`, as velada-dress met it: every token a page reads is declared by the theme. */
const authorChecks: CheckRunner = async (dir): Promise<CheckResult> => {
  const text = (await sources(dir)).join('\n');
  const declared = new Set([...text.matchAll(/declare\('([a-z-]+)'\)/g)].map(match => match[1]));
  const unknown = [...new Set([...text.matchAll(/token\('([a-z-]+)'\)/g)].map(match => match[1]))].filter(
    name => !declared.has(name)
  );

  return unknown.length === 0
    ? { ok: true, steps: [{ name: 'author', ok: true }] }
    : { ok: false, steps: [{ name: 'author', ok: false, said: [`unknown-variable: ${unknown.join(', ')}`] }] };
};

const as = (name: string, token?: string): RunContext =>
  bench.agent(name, { checks: authorChecks, ...(token ? { token } : {}) });

const THEME = 'src/space/theme.ts';

describe('a run played whole, as velada-dress went', () => {
  it('holds every rule it broke: base first, requests merged at approval, a lead that reviews answering, the finish whole', async () => {
    const plan = { ...benchPlan(), designReview: false };
    await bench.writeTeam({
      version: 1,
      lead: { count: 2 },
      agents: [{ name: 'dev', roles: ['developer'], count: 2, min: 1 }]
    });
    await openRun(as('lead'), await bench.writePlan(plan));
    const runId = plan.runId;

    // Who calls is proved: dev-1's name is its token's once given — said again alone, or that token under the lead's
    // name, refused (velada-polish: design-2, unnamed, was logged as the lead).
    const { paths } = await loadRun(as('lead'), runId);
    const dev1 = await identify(bench.root, paths, runId, { kind: 'name', said: 'dev-1' }, new Date());
    expect(dev1.issued?.token).toMatch(/^es-launch\.@dev-1\.[0-9a-f]{32}$/);
    await expect(identify(bench.root, paths, runId, { kind: 'name', said: 'dev-1' }, new Date())).rejects.toMatchObject(
      {
        code: 'identity'
      }
    );
    await expect(
      identify(bench.root, paths, runId, { kind: 'agent', token: dev1.issued?.token ?? '', said: 'lead' }, new Date())
    ).rejects.toMatchObject({ code: 'identity' });

    // The base first: dev-1 there and free, dev-2 — on demand — is handed what dev-1 cannot take.
    await followNext(as('dev-1'), runId, 'developer', { timeoutMs: 0, everyMs: 10 });
    const ready = (await nextTask(as('dev-1'), runId, 'developer')).ready;
    expect((await nextTask(as('dev-2'), runId, 'developer')).task?.id).toBe(ready[1]);

    // dev-1 takes t-home and holds the theme; dev-2's t-menu needs a token of it — a request.
    const home = await takeTask(as('dev-1'), runId, 't-home');
    await claimFile(as('dev-1', home.token), runId, 't-home', THEME);
    const menu = await takeTask(as('dev-2'), runId, 't-menu');
    const theme = (await readInCopy(menu.work, THEME)) ?? '';
    await writeInCopy(menu.work, THEME, `${theme}declare('menu-glow');\n`);
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', "export const menu = { glow: token('menu-glow') };\n");
    expect((await completeTask(as('dev-2', menu.token), runId, 't-menu')).requests.map(each => each.file)).toEqual([
      THEME
    ]);

    // In review, its request is no one's to act on yet: the lead is not woken for it — it goes in with the approval.
    expect((await viewRun(as('lead'), runId)).attention.some(item => item.kind === 'request')).toBe(false);

    // Approved, its request goes in though t-home holds the theme: the run's work never reads what it lacks.
    expect((await reviewTask(as('lead'), runId, 't-menu', 'approve', [])).fulfilled).toEqual([THEME]);
    const loaded = await loadRun(as('lead'), runId);
    const approvedTheme = (await readApproved(loaded.paths)).files[THEME].digest;
    expect(approvedTheme === null ? '' : (await getBlob(loaded.paths, approvedTheme)).toString()).toContain(
      "declare('menu-glow')"
    );

    // dev-2, at t-about, waits for the theme t-home holds — and does without it: it completes, out of the queue.
    const about = await takeTask(as('dev-2'), runId, 't-about');
    await waitForFile(as('dev-2', about.token), runId, 't-about', THEME);
    await writeInCopy(about.work, 'src/space/pages/about.ts', "export const page = { title: 't-about' };\n");
    await completeTask(as('dev-2', about.token), runId, 't-about');
    await reviewTask(as('lead'), runId, 't-about', 'approve', []);

    // dev-1 asks; lead-2, with no review waiting, is handed the question and answers it — the lead told.
    const asked = await askLead(as('dev-1', home.token), runId, 't-home', 'Bienvenidos or Bienvenida?');
    expect((await takeNext(as('lead-2'), runId, 'lead')).next.question?.id).toBe(asked.question.id);
    await messageTasks(as('lead-2'), runId, 't-home', 'Bienvenidos', asked.question.id);
    // A message goes out in the lead's voice: dev-2, proved, is no lead — refused, never sent as the lead.
    await expect(messageTasks(as('dev-2'), runId, 't-home', 'Bienvenida')).rejects.toMatchObject({ code: 'lead-only' });
    expect((await viewRun(as('lead'), runId)).tasks.find(task => task.id === 't-home')?.asking).toMatchObject({
      answered: true
    });

    // Its next command hands dev-1 the answer — it goes on — and brings the run's theme into its copy: author passes.
    await writeInCopy(
      home.work,
      'src/space/pages/home/index.ts',
      "export const home = { glow: token('menu-glow') };\n"
    );
    expect((await checkTask(as('dev-1', home.token), runId, 't-home')).ok).toBe(true);
    expect((await readRunLog(loaded.paths)).some(entry => entry.action === 'resumes' && entry.task === 't-home')).toBe(
      true
    );
    expect(
      (await monitorRun(as('lead'), runId)).feed.some(
        line => line.task === 't-home' && line.text === `goes on — ${asked.question.id} answered`
      )
    ).toBe(true);

    // The rest, done: lead-2 reviews what queues, the lead the last of it.
    await completeTask(as('dev-1', home.token), runId, 't-home');
    const reviewed = await takeNext(as('lead-2'), runId, 'lead');
    expect(reviewed.next.leadReview?.task.id).toBe('t-home');
    await reviewTask(as('lead-2'), runId, 't-home', 'approve', []);
    for (const [agent, taskId, file] of [['dev-2', 't-book', 'src/space/pages/book.ts']] as const) {
      const taken = await takeTask(as(agent), runId, taskId);
      await writeInCopy(taken.work, file, `export const page = { title: '${taskId}' };\n`);
      await completeTask(as(agent, taken.token), runId, taskId);
      await reviewTask(as('lead'), runId, taskId, 'approve', []);
    }

    expect((await viewRun(as('lead'), runId)).done).toBe(4);
    await bench.write('summary.md', '# What the run did\n\nTranslated the pages; nothing left.\n');
    await writeSummary(as('lead'), runId, 'summary.md', LEAD_SAID);
    const dry = await finishRun(bench.agent('person', { checks: authorChecks }), runId, {
      apply: false,
      leavePending: false
    });
    expect(dry.plan.apply.map(each => each.file)).toContain(THEME);

    // What it noticed and left is the next run's: kept in the project's backlog as it is written into the project.
    await noticeRun(as('lead'), runId, 'The book page has no map', { on: '/book' });
    const applied = await finishRun(
      bench.agent('person', { checks: authorChecks, person: () => Promise.resolve(true) }),
      runId,
      {
        apply: true,
        leavePending: false
      }
    );
    expect(applied.backlog).toEqual(['b-1']);
    expect((await openBacklog(bench.root)).map(item => item.text)).toEqual(['The book page has no map']);

    // Its report says where the time went and what it cost, and keeps it as data beside it: the bench's.
    const reports = await fs.readdir(path.join(bench.root, 'tmp', 'plitzi-reports'));
    const report = await fs.readFile(
      path.join(bench.root, 'tmp', 'plitzi-reports', reports.find(file => file.endsWith('.md')) ?? ''),
      'utf-8'
    );
    expect(report).toContain('## Flow — where the time went');
    expect(report).toContain('## Cost — what the CLI made the agents read');
    expect(report).toMatch(/\| t-menu \| dev-2 \|/);
    const [run] = await readBench(bench.root);
    expect(run).toMatchObject({ runId, tasks: 4, done: 4 });
    expect(run.roundsPerTask).toBeGreaterThanOrEqual(1);
    // A whole run played: ~4 s alone, past the default 5 s beside the rest of the suite.
  }, 30_000);
});

// velada-fidelity: dev-1 took t-faq-zone as "agent" (an empty token), and its rework went back to no one. A task is its
// holder's: another agent holding its copy's token acts on nothing of it, and the holder acts on it as itself.
describe('a task held by its holder alone', () => {
  it('refuses another agent the task, its copy’s token in hand, and keeps the work and the log the holder’s', async () => {
    const plan = { ...benchPlan(), designReview: false };
    await bench.writeTeam({ version: 1, agents: [{ name: 'dev', roles: ['developer'], count: 2 }] });
    await openRun(as('lead'), await bench.writePlan(plan));
    const home = await takeTask(as('dev-1'), plan.runId, 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");

    await expect(completeTask(as('dev-2', home.token), plan.runId, 't-home')).rejects.toMatchObject({
      code: 'identity',
      message: expect.stringContaining('Task "t-home" is dev-1\'s, not dev-2\'s') as unknown
    });
    await expect(reportProgress(as('dev-2', home.token), plan.runId, 't-home', {})).rejects.toMatchObject({
      code: 'identity'
    });

    await completeTask(as('dev-1', home.token), plan.runId, 't-home');
    const log = await readRunLog((await loadRun(as('lead'), plan.runId)).paths);
    expect(log.filter(entry => entry.task === 't-home').map(entry => entry.by)).not.toContain('dev-2');
    expect(log.some(entry => entry.by === 'agent')).toBe(false);
  });
  it('takes the next task from the copy of the one it completed: the copy says its task, never who takes', async () => {
    const plan = { ...benchPlan(), designReview: false };
    await bench.writeTeam({ version: 1, agents: [{ name: 'dev', roles: ['developer'], count: 2 }] });
    await openRun(as('lead'), await bench.writePlan(plan));
    const home = await takeTask(as('dev-1'), plan.runId, 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");
    await completeTask(as('dev-1', home.token), plan.runId, 't-home');

    const { taken } = await takeNext(as('dev-1', home.token), plan.runId, 'developer');

    expect(taken?.task.id).toBe('t-menu');
    expect(taken?.token).not.toBe(home.token);
  });
});

// The lead takes a task back from an agent at any time, says why, and decides where it goes (Carlos, velada-fidelity).
describe('a task the lead takes back', () => {
  it('goes to the agent it is handed to — no other — or to the lead itself; its agent is told why', async () => {
    const plan = { ...benchPlan(), designReview: false };
    await bench.writeTeam({ version: 1, agents: [{ name: 'dev', roles: ['developer'], count: 3 }] });
    await openRun(as('lead'), await bench.writePlan(plan));
    const menu = await takeTask(as('dev-1'), plan.runId, 't-menu');

    await expect(reassignTask(as('lead'), plan.runId, 't-menu', { to: 'design-9' })).rejects.toMatchObject({
      code: 'invalid',
      message: expect.stringContaining('no agent of the team') as unknown
    });
    expect((await reassignTask(as('lead'), plan.runId, 't-menu', { to: 'dev-3', reason: 'off the brief' })).to).toBe(
      'dev-3'
    );

    const told = (await nextTask(as('dev-1'), plan.runId, 'developer')).messages.map(message => message.text).join(' ');
    expect(told).toContain('t-menu was taken back by lead: off the brief — it is not yours now; it goes to dev-3');
    await expect(reportProgress(as('dev-1', menu.token), plan.runId, 't-menu', {})).rejects.toMatchObject({
      code: 'reassigned'
    });
    expect((await nextTask(as('dev-2'), plan.runId, 'developer')).task?.id).not.toBe('t-menu');
    await expect(takeTask(as('dev-2'), plan.runId, 't-menu')).rejects.toMatchObject({ code: 'claimed' });
    expect(await nextTask(as('dev-3'), plan.runId, 'developer')).toMatchObject({
      task: { id: 't-menu' },
      handedBy: { by: 'lead', reason: 'off the brief' }
    });
    const handed = await takeTask(as('dev-3'), plan.runId, 't-menu');

    const mine = await reassignTask(as('lead'), plan.runId, 't-menu', { to: 'lead', reason: 'I finish it' });
    expect(mine.taken?.work).toBeDefined();
    expect(mine.from).toBe('dev-3');
    await expect(reportProgress(as('dev-3', handed.token), plan.runId, 't-menu', {})).rejects.toMatchObject({
      code: 'reassigned'
    });
    const log = await readRunLog((await loadRun(as('lead'), plan.runId)).paths);
    expect(log.filter(entry => entry.action === 'reassign').map(entry => [entry.from, entry.to, entry.reason])).toEqual(
      [
        ['dev-1', 'dev-3', 'off the brief'],
        ['dev-3', 'lead', 'I finish it']
      ]
    );
  });
});

// velada-polish: right after a `complete` told an agent to take no other step, `task next` handed back the task it held
// "unblocked" — never blocked: it was held all along.
describe('a task handed back to its own agent', () => {
  it('says it is held all along, or unblocked by the lead, as it is', async () => {
    const plan = { ...benchPlan(), designReview: false };
    await openRun(as('lead'), await bench.writePlan(plan));
    const home = await takeTask(as('dev-1'), plan.runId, 't-home');
    expect(await nextTask(as('dev-1'), plan.runId, 'developer')).toMatchObject({
      task: { id: 't-home' },
      back: 'held'
    });

    await blockTask(as('dev-1', home.token), plan.runId, 't-home', 'Which greeting?', 'lead');
    await unblockTask(as('lead'), plan.runId, 't-home', 'Bienvenidos');
    expect(await nextTask(as('dev-1'), plan.runId, 'developer')).toMatchObject({
      task: { id: 't-home' },
      back: 'unblocked'
    });
  });
});
