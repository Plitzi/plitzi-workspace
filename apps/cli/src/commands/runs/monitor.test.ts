import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { monitorScreen } from './monitor';
import { monitorRun } from '../../runs/monitor';
import { askLead, messageTasks, noteRun } from '../../runs/talk';
import { completeTask, reviewTask } from '../../runs/tasks';
import { makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

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
    expect(screen.some(line => /lead → agent-2\s+“Use the formal voice” · t-home/.test(line))).toBe(true);
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
    for (const text of [
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve'
    ]) {
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
      screen.slice(screen.findIndex(line => line.startsWith('ACTIVITY')) + 1, -2).filter(line => line.trim() !== '');
    const shown = Array.from({ length: pages }, (_, page) => activityOf(at(page))).flat();
    expect(shown).toHaveLength(data.feed.length);
  });

  it('keeps the legend of the keys on screen however long the activity, each area saying its own', async () => {
    const runId = await open();
    for (const text of ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']) {
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

  it('fits the terminal: every line its width, the feed cut to the rows left', async () => {
    const data = await monitorRun(lead(), await open());
    const screen = monitorScreen(data, { selected: 0, open: true, width: 60, height: 20, now: bench.now() });

    expect(screen.every(line => stripVTControlCharacters(line).length <= 60)).toBe(true);
  });
});
