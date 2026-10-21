import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { monitorScreen } from './monitor';
import { monitorRun } from '../../runs/monitor';
import { messageTasks } from '../../runs/talk';
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
    const screen = plain(monitorScreen(data, { selected: 0, open: false, width: 160, height: 60, now: bench.now() }));

    expect(screen[0]).toContain(`RUN ${runId} · OPEN · 1 of 4 approved`);
    expect(screen.some(line => line.includes('t-about') && line.includes('✓ approved'))).toBe(true);
    expect(
      screen.some(line => line.includes('agent-2') && line.includes('● working') && line.includes('writes t-home'))
    ).toBe(true);
    expect(screen.some(line => line.includes('agent-3') && line.includes('○ idle'))).toBe(true);
    expect(screen.some(line => line.includes('lead') && line.includes('approved t-about'))).toBe(true);
    expect(screen.some(line => line.includes('→ t-home: Use the formal voice'))).toBe(true);
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
    const screen = plain(monitorScreen(data, { selected: 0, open: true, width: 160, height: 60, now: bench.now() }));
    const rows = screen.filter(line => /^[ ›] t-/.test(line));

    expect(rows[0]).toContain('t-home');
    expect(rows.at(-1)).toMatch(/t-about\s+✓ approved · agent-1 · \d+m of \d+/);
    expect(screen.some(line => line.includes('1 at work') && line.includes('pending'))).toBe(true);
    expect(screen.some(line => line.includes('agent-1') && line.includes('✓1'))).toBe(true);
    expect(screen.some(line => line.trim().startsWith('t-home — '))).toBe(true);
  });

  it('fits the terminal: every line its width, the feed cut to the rows left', async () => {
    const data = await monitorRun(lead(), await open());
    const screen = monitorScreen(data, { selected: 0, open: true, width: 60, height: 20, now: bench.now() });

    expect(screen.every(line => stripVTControlCharacters(line).length <= 60)).toBe(true);
  });
});
