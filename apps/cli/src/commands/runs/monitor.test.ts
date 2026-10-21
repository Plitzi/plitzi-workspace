import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { monitorScreen } from './monitor';
import { flowLines } from './monitorFlow';
import { groupRepeats, monitorRun } from '../../runs/monitor';
import { askLead, messageTasks, noteRun } from '../../runs/talk';
import { completeTask, reviewTask } from '../../runs/tasks';
import { makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

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
    const rows = screen.filter(line => /^[ ›] t-/.test(line));

    expect(rows[0]).toContain('t-home');
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
      // After its title and the columns' names, before the keys and the legend.
      screen.slice(screen.findIndex(line => line.startsWith('ACTIVITY')) + 2, -2).filter(line => line.trim() !== '');
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

  it('draws the run as a flow, each task in its stage, the review split and what is sent back', async () => {
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
    expect(flow.some(line => line.includes('sent back (0)'))).toBe(true);

    // A question to the lead holds its agent: the task is held, saying why, and no longer at work.
    const asked = await askLead(home.ctx, runId, 't-home', 'Spanish or Catalan?');
    const held = plain(flowLines((await monitorRun(lead(), runId)).view.tasks, 200));
    expect(held.find(line => line.includes('pending'))).toMatch(/at work \(0\).*held \(1\)/);
    expect(held.some(line => line.includes(`t-home asks lead (${asked.question.id})`))).toBe(true);

    // Sent back by the lead: to the same agent, said apart from the steps, with its round.
    await reviewTask(lead(), runId, 't-menu', 'changes', [{ note: 'Spanish prices' }]);
    const back = plain(flowLines((await monitorRun(lead(), runId)).view.tasks, 220));
    expect(back.find(line => line.includes('pending'))).toMatch(/approved \(1\)\s+│ ↺ sent back \(1\)/);
    expect(back.some(line => line.includes('t-menu agent-3 r1'))).toBe(true);
  });

  it('says which rows the tasks and the activity take, where the wheel scrolls each', async () => {
    const runId = await open();
    await noteRun(lead(), runId, 'A note');
    let regions = { tasks: [0, 0], activity: [0, 0] };
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

    const taskRow = screen.findIndex(line => line.includes('t-home'));
    expect(taskRow).toBeGreaterThanOrEqual(regions.tasks[0]);
    expect(taskRow).toBeLessThan(regions.tasks[1]);
    const noteRow = screen.findIndex(line => line.includes('“A note”'));
    expect(noteRow).toBeGreaterThanOrEqual(regions.activity[0]);
    expect(noteRow).toBeLessThan(regions.activity[1]);
  });

  it('fits the terminal: every line its width, the feed cut to the rows left', async () => {
    const data = await monitorRun(lead(), await open());
    const screen = monitorScreen(data, { selected: 0, open: true, width: 60, height: 20, now: bench.now() });

    expect(screen.every(line => stripVTControlCharacters(line).length <= 60)).toBe(true);
  });
});
