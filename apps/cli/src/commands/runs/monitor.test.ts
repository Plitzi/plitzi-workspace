import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { monitorScreen, wheelTarget } from './monitor';
import { flowBoard, flowLines } from './monitorFlow';
import { extendRun } from '../../runs/extend';
import { groupRepeats, monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { logRun, stopRun } from '../../runs/run';
import { askLead, messageTasks, noteRun, tellLead } from '../../runs/talk';
import { completeTask, followNext, reportProgress, reviewTask } from '../../runs/tasks';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Regions } from './monitor';
import type { RunPlan } from '../../runs/model';
import type { FeedLine } from '../../runs/monitor';
import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { doTask, lead, open, take } = runSteps(() => bench);

const plain = (lines: string[]): string[] => lines.map(line => stripVTControlCharacters(line).trimEnd());

describe('plitzi run monitor', () => {
  it('shows the run on top, tasks beside agents with what each is at, and what happened last', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(about.ctx, runId, 't-about');
    await reviewTask(lead(), runId, 't-about', 'approve', []);
    await take('agent-2', 't-home');
    await messageTasks(lead(), runId, 't-home', 'Use the formal voice');

    const data = await monitorRun(lead(), runId);
    const screen = plain(
      monitorScreen(data, { selected: 0, open: false, width: 160, height: 60, now: bench.now(), showApproved: true })
    );

    expect(screen[0]).toContain(`RUN ${runId} · OPEN · 1 of 4 approved`);
    // The board's default: what is left listed, the approved said in a line.
    expect(
      plain(monitorScreen(data, { selected: 0, open: false, width: 160, height: 60, now: bench.now() })).some(line =>
        line.includes('✓ 1 approved (a lists them): t-about')
      )
    ).toBe(true);
    expect(screen.some(line => line.includes('t-about') && line.includes('✓ approved'))).toBe(true);
    expect(
      screen.some(line => line.includes('agent-2') && line.includes('● working') && line.includes('writes t-home'))
    ).toBe(true);
    expect(screen.some(line => line.includes('agent-3') && line.includes('○ idle'))).toBe(true);
    expect(screen.some(line => line.includes('lead') && line.includes('approved t-about'))).toBe(true);
    expect(screen.some(line => /lead → agent-2\s+t-home\s+“Use the formal voice”/.test(line))).toBe(true);
  });

  it('lists the work first and says who did each task, in how many rounds, and its time against its estimate', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(about.ctx, runId, 't-about');
    await reviewTask(lead(), runId, 't-about', 'approve', []);
    await take('agent-2', 't-home');

    const data = await monitorRun(lead(), runId);
    expect(data.stories['t-about']).toMatchObject({ writers: ['agent-1'], approvedBy: 'lead', sentBack: 0 });
    const screen = plain(
      monitorScreen(data, { selected: 0, open: true, width: 160, height: 60, now: bench.now(), showApproved: true })
    );
    const rows = screen.filter(line => /^[ ›] [ !‼]t-/.test(line));

    // Urgent at a glance: t-home is high — marked in the list and on its card in the flow; approved, nothing is.
    expect(rows[0]).toMatch(/^› !t-home/);
    expect(screen.some(line => line.includes('! t-home agent-2'))).toBe(true);
    expect(rows.at(-1)).toMatch(/^ {3}t-about/);
    expect(rows.at(-1)).toMatch(/t-about\s+✓ approved · agent-1 · \d+m of \d+/);
    expect(screen.some(line => line.includes('1 at work') && line.includes('pending'))).toBe(true);
    expect(screen.some(line => line.includes('agent-1') && line.includes('✓1'))).toBe(true);
    expect(screen.some(line => line.trim().startsWith('t-home — '))).toBe(true);
  });

  it('pages through the whole activity, newest first, and says where it is', async () => {
    const runId = await open();
    for (const text of Array.from({ length: 24 }, (_, index) => String(index + 1))) {
      await noteRun(lead(), runId, `Note ${text}`);
    }

    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);
    let pages = 0;
    const at = (feedPage: number) =>
      plain(
        monitorScreen(data, {
          selected: 0,
          open: false,
          width: 160,
          height: 32,
          now: bench.now(),
          feedPage,
          onFeedPages: count => (pages = count)
        })
      );
    const first = at(0);
    expect(pages).toBeGreaterThan(1);
    expect(first.find(line => line.startsWith('ACTIVITY'))).toContain('older →');
    const last = at(99);
    expect(last.find(line => line.startsWith('ACTIVITY'))).toContain('← newer');
    // Every page, one after another, is the whole activity once.
    const activityOf = (screen: string[]) =>
      // After its title and the columns' names, before the keys and the legend — as many lines as the width wraps them in.
      screen
        .slice(
          screen.findIndex(line => line.startsWith('ACTIVITY')) + 2,
          screen.findIndex(line => line.startsWith('q quits'))
        )
        .filter(line => line.trim() !== '');
    const shown = Array.from({ length: pages }, (_, page) => activityOf(at(page))).flat();
    expect(shown).toHaveLength(data.feed.length);
  });

  it('keeps the legend of the keys on screen however long the activity, each area saying its own', async () => {
    const runId = await open();
    for (const text of Array.from({ length: 24 }, (_, index) => String(index + 1))) {
      await noteRun(lead(), runId, `Note ${text}`);
    }

    const screen = plain(
      monitorScreen(await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER), {
        selected: 0,
        open: false,
        width: 160,
        height: 30,
        now: bench.now()
      })
    );
    expect(screen).toHaveLength(30);
    expect(screen.at(-2)).toContain('q quits');
    expect(screen.at(-1)).toContain('✓ approved');
    expect(screen.find(line => line.startsWith('TASKS'))).toContain('↑↓ choose');
    expect(screen.find(line => line.startsWith('ACTIVITY'))).toContain('older →');
  });

  it('says a task held on a question to the lead, on its row, its agent and the head — until it is answered', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    const asked = await askLead(home.ctx, runId, 't-home', 'Spanish or Catalan?');
    const screenOf = async () =>
      plain(
        monitorScreen(await monitorRun(lead(), runId), {
          selected: 0,
          open: true,
          width: 170,
          height: 60,
          now: bench.now()
        })
      );

    const held = await screenOf();
    expect(held.some(line => line.includes(`? agent-1 asks the lead (${asked.question.id})`))).toBe(true);
    expect(held.some(line => line.includes('agent-1') && line.includes('? asks the lead'))).toBe(true);
    expect(held[2]).toContain('1 asking the lead');

    await messageTasks(lead(), runId, 't-home', 'Spanish', asked.question.id);
    expect((await screenOf()).some(line => line.includes('asks the lead'))).toBe(false);
  });

  it('says an event repeated in a row once, how many times and since when — and the lead done once all is approved', async () => {
    const refused = (at: string, message: string): FeedLine => ({
      at,
      by: 'lead',
      kind: 'problem',
      text: `refused (checks-failed): plitzi run finish — ${message}`,
      group: 'refused:checks-failed:plitzi run finish'
    });
    const grouped = groupRepeats([
      refused('2026-10-21T10:03:00.000Z', 't-boxers-list'),
      refused('2026-10-21T10:01:00.000Z', 't-pages'),
      refused('2026-10-21T09:58:00.000Z', 't-boxers-list'),
      { at: '2026-10-21T09:50:00.000Z', by: 'dev-1', kind: 'take', text: 'took t-morph', task: 't-morph' }
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ count: 3, since: '2026-10-21T09:58:00.000Z' });
    expect(grouped[0].text).toContain('t-boxers-list');

    const runId = await open();
    for (const [name, task, file] of [
      ['agent-1', 't-home', 'src/space/pages/home/hero.ts'],
      ['agent-2', 't-menu', 'src/space/pages/menu.ts'],
      ['agent-3', 't-about', 'src/space/pages/about.ts']
    ] as const) {
      const held = await take(name, task);
      await writeInCopy(held.work, file, `export const page = ${JSON.stringify(task)};\n`);
      await completeTask(held.ctx, runId, task);
      await reviewTask(lead(), runId, task, 'approve', []);
    }
    const book = await take('agent-4', 't-book');
    await writeInCopy(book.work, 'src/space/pages/book.ts', 'export const book = {};\n');
    await completeTask(book.ctx, runId, 't-book');
    await reviewTask(lead(), runId, 't-book', 'approve', []);

    const done = (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'lead');
    expect(done).toMatchObject({ status: 'done', doing: expect.stringContaining('plitzi run finish') as unknown });
  });

  it('opens a group of repeated events where it is clicked, and folds it again', async () => {
    const runId = await open();
    await noteRun(lead(), runId, 'The CDN is slow');
    await noteRun(lead(), runId, 'The CDN is slow');
    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);
    const group = data.feed.find(line => line.count === 2);
    expect(group?.repeats).toHaveLength(2);

    let rows = new Map<number, string>();
    const screenOf = (opened: Set<string>) =>
      plain(
        monitorScreen(data, {
          selected: 0,
          open: false,
          width: 170,
          height: 60,
          now: bench.now(),
          opened,
          onGroupRows: each => (rows = each)
        })
      );
    const folded = screenOf(new Set());
    const [row, key] = [...rows][0];
    expect(folded[row].startsWith('▸ ')).toBe(true);
    expect(folded[row]).toContain('×2');
    expect(folded.filter(line => line.includes('└'))).toHaveLength(0);

    const unfolded = screenOf(new Set([key]));
    expect(unfolded[row].startsWith('▾ ')).toBe(true);
    const repeats = unfolded.filter(line => line.includes('└') && line.includes('The CDN is slow'));
    expect(repeats).toHaveLength(2);
    // Each repeat's words hang a little right of its group's WHAT.
    expect(repeats.every(line => line.indexOf('“The CDN') === unfolded[row].indexOf('“The CDN') + 2)).toBe(true);
  });

  it('draws the run as a flow, each task in its stage, the review split, and one sent back at work again', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const home = await take('agent-2', 't-home');
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const flow = plain(flowLines((await monitorRun(lead(), runId)).view.tasks, 200));
    const head = flow.find(line => line.includes('pending')) ?? '';
    expect(head).toMatch(
      /pending \(1\).*ready \(0\).*at work \(1\).*held \(0\).*UI review \(0\).*lead review \(1\).*approved \(1\)/
    );
    expect(flow.some(line => line.includes('t-home agent-2') && line.includes('t-menu no lead yet'))).toBe(true);

    // A question to the lead holds its agent: the task is held, saying why, and no longer at work.
    const asked = await askLead(home.ctx, runId, 't-home', 'Spanish or Catalan?');
    const held = plain(flowLines((await monitorRun(lead(), runId)).view.tasks, 200));
    expect(held.find(line => line.includes('pending'))).toMatch(/at work \(0\).*held \(1\)/);
    expect(held.some(line => line.includes(`t-home asks lead (${asked.question.id})`))).toBe(true);

    // Sent to review with the question still open, it stands in review alone: a task is in one column at a time.
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = { es: true };\n');
    await completeTask(home.ctx, runId, 't-home');
    const sent = plain(flowLines((await monitorRun(lead(), runId)).view.tasks, 200));
    expect(sent.find(line => line.includes('pending'))).toMatch(/held \(0\).*lead review \(2\)/);
    expect(sent.filter(line => line.includes('t-home'))).toHaveLength(1);

    // Sent back by the lead: at work again, its agent's — never "ready", free to take — marked with its round.
    await reviewTask(lead(), runId, 't-menu', 'changes', [{ note: 'Spanish prices' }]);
    const back = plain(flowLines((await monitorRun(lead(), runId)).view.tasks, 220));
    expect(back.find(line => line.includes('pending'))).toMatch(/ready \(0\).*at work \(1\)/);
    expect(back.some(line => line.includes('t-menu ↺1 agent-3'))).toBe(true);
    expect(back.some(line => line.includes('sent back ('))).toBe(false);
  });

  // velada-dress: dev-2 stood "ready" with t-home, sent back, and "at work" with t-overlay at once — one agent, two
  // cards, and no telling which it was at.
  it('shows an agent at one task at a time: the one it last worked on, the others held for it', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    bench.advance(60_000);
    await take('agent-1', 't-menu');
    bench.advance(60_000);
    await reportProgress(home.ctx, runId, 't-home', { step: 'the hero' });

    const { view, agents } = await monitorRun(lead(), runId);
    const flow = plain(flowLines(view.tasks, 220));
    expect(flow.find(line => line.includes('pending'))).toMatch(/at work \(1\).*held \(1\)/);
    expect(flow.some(line => line.includes('t-home agent-1'))).toBe(true);
    expect(flow.some(line => line.includes('t-menu agent-1 at t-home'))).toBe(true);
    expect(agents.find(agent => agent.agent === 'agent-1')).toMatchObject({
      task: 't-home',
      doing: expect.stringContaining('also holds t-menu (in-progress)') as unknown
    });
  });

  // velada-dress: agents stopped by their harness still read "working" and "waiting" — a wait is said once, and nothing
  // told a live agent from a gone one.
  it('says an agent between tasks is gone once nothing marked it present for a while', async () => {
    const runId = await open();
    await take('agent-1', 't-home');
    await take('agent-2', 't-menu');
    await take('agent-3', 't-about');
    await followNext(bench.agent('agent-4'), runId, 'developer', { timeoutMs: 30, everyMs: 10 });
    const row = async () => (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'agent-4');

    expect((await row())?.status).toBe('idle');
    bench.advance(3 * 60_000);
    expect(await row()).toMatchObject({
      status: 'no-signal',
      doing: expect.stringContaining('no sign of it for 3 min') as unknown
    });
  });

  // velada-dress: the brake stopped the run and design-1, waiting for it to go on, read "no signal" — gone, it was not.
  it('keeps an agent waiting through a stopped run present, its row saying what it waits for', async () => {
    const runId = await open();
    await stopRun(lead(), runId, false, 'the brake');
    bench.advance(3 * 60_000);
    await followNext(bench.agent('agent-4'), runId, 'developer', { timeoutMs: 30, everyMs: 10 });
    expect((await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'agent-4')).toMatchObject({
      status: 'idle',
      doing: expect.stringContaining('waits for the run to go on — it is stopping') as unknown
    });
  });

  it('says which rows the tasks and the activity take, where the wheel scrolls each', async () => {
    const runId = await open();
    await noteRun(lead(), runId, 'A note');
    let regions: Regions = { flow: [], tasks: [0, 0], activity: [0, 0] };
    const screen = plain(
      monitorScreen(await monitorRun(lead(), runId), {
        selected: 0,
        open: false,
        width: 170,
        height: 50,
        now: bench.now(),
        onRegions: each => (regions = each)
      })
    );

    // Its row in the tasks' list — the flow above names it too.
    const listTop = screen.findIndex(line => line.startsWith('TASKS'));
    const taskRow = screen.findIndex((line, index) => index > listTop && line.includes('t-home'));
    expect(taskRow).toBeGreaterThanOrEqual(regions.tasks[0]);
    expect(taskRow).toBeLessThan(regions.tasks[1]);
    const noteRow = screen.findIndex(line => line.includes('“A note”'));
    expect(noteRow).toBeGreaterThanOrEqual(regions.activity[0]);
    expect(noteRow).toBeLessThan(regions.activity[1]);

    // Over a stage of the flow the wheel scrolls its cards — never the activity's pages under it; over its title, nothing.
    const flowRow = screen.findIndex(line => line.startsWith('FLOW'));
    expect(wheelTarget(flowRow, 3, regions)).toBeUndefined();
    expect(wheelTarget(flowRow + 1, 3, regions)).toMatchObject({ stage: { stage: 0 } });
    expect(wheelTarget(taskRow, 3, regions)).toBe('tasks');
    expect(
      wheelTarget(
        screen.findIndex(line => line.startsWith('ACTIVITY')),
        3,
        regions
      )
    ).toBe('activity');
    expect(wheelTarget(noteRow, 3, regions)).toBe('activity');
  });

  // Not every terminal is a wide monitor: the board fits each — the flow in bands, the agents under the tasks, the keys
  // wrapped — and the flow is always there, the kanban being what the board is for.
  it('fits every terminal, from a laptop pane to a wide monitor, the flow always on it', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    await take('agent-2', 't-home');
    for (const text of Array.from({ length: 20 }, (_, index) => `Note ${String(index + 1)}`)) {
      await noteRun(lead(), runId, text);
    }

    const data = await monitorRun(lead(), runId);
    for (const [width, height] of [
      [60, 20],
      [80, 24],
      [100, 30],
      [120, 40],
      [160, 50],
      [220, 60]
    ] as const) {
      const screen = plain(monitorScreen(data, { selected: 0, open: false, width, height, now: bench.now() }));
      const at = `${String(width)}×${String(height)}`;
      expect(screen.length, at).toBeLessThanOrEqual(height);
      expect(Math.max(...screen.map(line => line.length)), at).toBeLessThanOrEqual(width);
      expect(
        screen.some(line => line.startsWith('FLOW')),
        at
      ).toBe(true);
      for (const stage of ['pending', 'ready', 'at work', 'held', 'UI review', 'lead review', 'approved']) {
        expect(
          screen.some(line => line.includes(`${stage} (`)),
          `${at}: ${stage}`
        ).toBe(true);
      }

      expect(
        screen.some(line => line.startsWith('TASKS')),
        at
      ).toBe(true);
      expect(
        screen.some(line => line.includes('AGENTS')),
        at
      ).toBe(true);
      // The keys wrapped, never cut: the last of them is on screen whole.
      expect(
        screen.some(line => line.includes('←→ the activity')),
        at
      ).toBe(true);
      const activity = screen.findIndex(line => line.startsWith('ACTIVITY'));
      const keys = screen.findIndex(line => line.startsWith('q quits'));
      // A few events from 24 rows on — a shorter terminal gives its rows to the board.
      if (height >= 24) {
        expect(activity, at).toBeGreaterThan(0);
        expect(keys - activity - 3, at).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // A long plan is scrolled through, not laid out whole: the rows it would take are the activity's.
  it('lists fifteen tasks at most, the rest scrolled to, and gives the activity the rows left', async () => {
    const plan = benchPlan();
    plan.tasks = Array.from({ length: 20 }, (_, index) => ({
      id: `t-page-${String(index + 1)}`,
      title: `Page ${String(index + 1)}`,
      files: [`src/space/pages/p${String(index + 1)}.ts`],
      dependsOn: [],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: []
    }));
    const runId = await open(plan);
    for (const text of Array.from({ length: 30 }, (_, index) => `Note ${String(index + 1)}`)) {
      await noteRun(lead(), runId, text);
    }

    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);
    const at = (selected: number) =>
      plain(monitorScreen(data, { selected, open: false, width: 200, height: 70, now: bench.now() }));
    const screen = at(0);
    const listTop = screen.findIndex(line => line.startsWith('TASKS'));
    const listed = screen.slice(listTop + 1).filter(line => / t-page-\d+ /.test(line.split('│')[0] ?? ''));
    expect(listed).toHaveLength(15);
    expect(screen[listTop]).toContain('↓ 5 more');
    // Scrolled: the last one chosen is in the list.
    expect(at(19).some(line => (line.split('│')[0] ?? '').includes('t-page-20 '))).toBe(true);
    const activity = screen.findIndex(line => line.startsWith('ACTIVITY'));
    const keys = screen.findIndex(line => line.startsWith('q quits'));
    expect(keys - activity - 3).toBeGreaterThan(10);

    // A stage with more cards than it shows is scrolled by the wheel over it: what is above and below it is counted.
    const ready = flowBoard(data.view.tasks, 200, { depth: 8 });
    const column = ready.columns.find(each => each.stage === 1);
    expect(column?.max).toBe(12);
    expect(plain(ready.lines).some(line => line.includes('+ 12 more'))).toBe(true);
    const scrolled = plain(flowBoard(data.view.tasks, 200, { depth: 8, offsets: new Map([[1, 5]]) }).lines);
    expect(scrolled.some(line => line.includes('↑ 5 · + 7 more'))).toBe(true);
    expect(scrolled.some(line => / t-page-6(\s|$)/.test(line))).toBe(true);
    expect(scrolled.some(line => / t-page-1(\s|$)/.test(line))).toBe(false);
    // Never past its last card, however far it is asked.
    const end = plain(flowBoard(data.view.tasks, 200, { depth: 8, offsets: new Map([[1, 99]]) }).lines);
    expect(end.some(line => line.includes('↑ 12') && !line.includes('more'))).toBe(true);
    expect(end.some(line => / t-page-20(\s|$)/.test(line))).toBe(true);
  });

  // Its task in review is its reviewer's: the agent that wrote it is free — idle, saying it sent it — never "in review"
  // as if at work.
  it('shows an agent whose task waits for its review as idle, the task its reviewer’s', async () => {
    const runId = await open();
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const agent = (await monitorRun(lead(), runId)).agents.find(each => each.agent === 'agent-3');
    expect([agent?.status, agent?.doing, agent?.task]).toEqual([
      'idle',
      expect.stringContaining('sent t-menu to review') as unknown,
      undefined
    ]);
  });

  // la-velada: a designer waiting for its first review showed the whole reason of the wait on its row — every task and
  // its status; the activity says that, the row says how the run stands.
  it('says an agent waiting for its first task in a few words, not the list of every task', async () => {
    const runId = await open();
    await take('agent-3', 't-menu');
    await logRun(bench.agent('agent-4'), runPaths(bench.root, runId), {
      action: 'waiting',
      why: 'nothing is ready: t-menu in-progress (agent-3), t-home pending (waits for t-menu), t-about pending (waits for t-menu)'
    });

    const agent = (await monitorRun(lead(), runId)).agents.find(each => each.agent === 'agent-4');
    // Idle: a wait for work is no work — the line says what it waits for.
    expect([agent?.status, agent?.doing]).toEqual([
      'idle',
      expect.stringMatching(/^waiting for its first task — 1 at work/)
    ]);
    expect(agent?.doing).not.toContain('t-home');
  });

  // la-velada: t-motion sat pending while the three it followed waited for one designer — nothing on screen said so.
  it('says what a pending task waits for, and where each of those stands, on its row and in the flow', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await completeTask(home.ctx, runId, 't-home');
    const data = await monitorRun(lead(), runId);
    const waiting = data.view.tasks.find(task => task.status === 'pending' && task.waitsOn?.includes('t-home'));
    if (!waiting) {
      throw new Error('the bench plan has a task after t-home');
    }

    const screen = plain(monitorScreen(data, { selected: 0, open: false, width: 220, height: 60, now: bench.now() }));
    expect(
      screen.some(line => line.includes(waiting.id) && line.includes('· pending — after t-home (lead review)'))
    ).toBe(true);
    expect(plain(flowLines(data.view.tasks, 220)).some(line => line.includes(`${waiting.id} ← t-home`))).toBe(true);
  });

  // Names, models and states of different lengths left the agents' rows ragged: what each does started anywhere.
  it('lays the agents out in columns, what each does starting where every other’s does', async () => {
    const runId = await open();
    await take('agent-3', 't-menu');
    const data = await monitorRun(lead(), runId);
    const screen = plain(
      monitorScreen(data, { selected: 0, open: false, width: 220, height: 60, now: bench.now(), showApproved: true })
    );
    const starts = data.agents.map(agent => {
      const line = screen.find(each => each.includes(` ${agent.agent} `) && each.includes(agent.doing.slice(0, 20)));

      return line ? line.indexOf(agent.doing.slice(0, 20), line.indexOf(` ${agent.agent} `)) : -1;
    });

    expect(starts.every(start => start > 0)).toBe(true);
    expect(new Set(starts).size).toBe(1);
  });

  // `complete --note` tells the lead as it completes: one event, said on one line of the activity.
  it('says a completion and its note on one line, and a tell said later apart', async () => {
    const runId = await open();
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await tellLead(menu.ctx, runId, 't-menu', 'Prices in euros, two decimals');
    bench.advance(60_000);
    await tellLead(menu.ctx, runId, 't-menu', 'One more thing');

    const feed = (await monitorRun(lead(), runId)).feed.filter(line => line.task === 't-menu');
    expect(feed.find(line => line.kind === 'complete')?.text).toBe(
      'sent t-menu to review — “Prices in euros, two decimals”'
    );
    expect(feed.filter(line => line.kind === 'message').map(line => line.quote)).toEqual(['One more thing']);
  });

  // A run with stages stacked on it says the one at work: its head named the first goal alone, cut at the width.
  it('says the stage a run is at, and its goal', async () => {
    const runId = await open();
    const stage: RunPlan = {
      version: 1,
      runId: 'es-contact',
      goal: 'A contact page',
      tasks: [
        {
          id: 't-contact',
          title: 'A contact page',
          files: ['src/space/pages/contact.ts'],
          dependsOn: [],
          priority: 'medium',
          estimateMinutes: 10,
          acceptance: ['The form is there']
        }
      ]
    };
    await extendRun(lead(), runId, await bench.writePlan(stage));

    const data = await monitorRun(lead(), runId);
    expect(data.stage).toEqual({ name: 'es-contact', goal: 'A contact page', of: 2 });
    const screen = plain(monitorScreen(data, { selected: 0, open: false, width: 160, height: 50, now: bench.now() }));
    expect(screen[0]).toContain(`RUN ${runId} · stage 2: es-contact ·`);
    expect(screen[1]).toBe(' A contact page');
  });

  it('fits the terminal: every line its width, the feed cut to the rows left', async () => {
    const data = await monitorRun(lead(), await open());
    const screen = monitorScreen(data, { selected: 0, open: true, width: 60, height: 20, now: bench.now() });

    expect(screen.every(line => stripVTControlCharacters(line).length <= 60)).toBe(true);
  });
});
