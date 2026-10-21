import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { finishRun } from './merge';
import { monitorRun } from './monitor';
import { writeSummary } from './report';
import { loadRun, openRun, readApproved, readRunLog } from './run';
import { getBlob } from './store';
import { askLead, messageTasks } from './talk';
import { checkTask, claimFile, completeTask, followNext, nextTask, reviewTask, takeNext, takeTask } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, readInCopy, writeInCopy } from '../tests/runProject';

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

    // Approved, its request goes in though t-home holds the theme: the run's work never reads what it lacks.
    expect((await reviewTask(as('lead'), runId, 't-menu', 'approve', [])).fulfilled).toEqual([THEME]);
    const loaded = await loadRun(as('lead'), runId);
    const approvedTheme = (await readApproved(loaded.paths)).files[THEME].digest;
    expect(approvedTheme === null ? '' : (await getBlob(loaded.paths, approvedTheme)).toString()).toContain(
      "declare('menu-glow')"
    );

    // dev-1 asks; lead-2, with no review waiting, is handed the question and answers it — the lead told.
    const asked = await askLead(as('dev-1', home.token), runId, 't-home', 'Bienvenidos or Bienvenida?');
    expect((await takeNext(as('lead-2'), runId, 'lead')).next.question?.id).toBe(asked.question.id);
    await messageTasks(as('lead-2'), runId, 't-home', 'Bienvenidos', asked.question.id);
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
        line => line.text === `goes on with t-home — ${asked.question.id} answered`
      )
    ).toBe(true);

    // The rest, done: lead-2 reviews what queues, the lead the last of it.
    await completeTask(as('dev-1', home.token), runId, 't-home');
    const reviewed = await takeNext(as('lead-2'), runId, 'lead');
    expect(reviewed.next.leadReview?.task.id).toBe('t-home');
    await reviewTask(as('lead-2'), runId, 't-home', 'approve', []);
    for (const [agent, taskId, file] of [
      ['dev-1', 't-about', 'src/space/pages/about.ts'],
      ['dev-2', 't-book', 'src/space/pages/book.ts']
    ] as const) {
      const taken = await takeTask(as(agent), runId, taskId);
      await writeInCopy(taken.work, file, `export const page = { title: '${taskId}' };\n`);
      await completeTask(as(agent, taken.token), runId, taskId);
      await reviewTask(as('lead'), runId, taskId, 'approve', []);
    }

    expect((await viewRun(as('lead'), runId)).done).toBe(4);
    await bench.write('summary.md', '# What the run did\n\nTranslated the pages; nothing left.\n');
    await writeSummary(as('lead'), runId, 'summary.md');
    const dry = await finishRun(bench.agent('person', { checks: authorChecks }), runId, {
      apply: false,
      leavePending: false
    });
    expect(dry.plan.apply.map(each => each.file)).toContain(THEME);
  });
});
