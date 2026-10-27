import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initialUi } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../runs/monitor';
import { noteRun } from '../../runs/talk';
import { completeTask, reviewTask } from '../../runs/tasks';
import { makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { MonitorUi } from './monitorModel';
import type { Screen } from './monitorScreen';
import type { Monitored } from '../../runs/monitor';
import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

/** The advanced panel drawn at a terminal's size: its screen and its plain text, a row a line. */
const shown = (data: Monitored, ui: Partial<MonitorUi> = {}): { screen: Screen; text: string[] } => {
  const screen = monitorScreen(
    data,
    { ...initialUi('advanced'), ...ui },
    { width: 160, height: 48, now: bench.now(), theme: THEMES.dark, preview: { state: { kind: 'none' }, output: [] } }
  );

  return { screen, text: screen.canvas.text() };
};

describe('the monitor, read on a run well under way', () => {
  // Carlos: with most of a run approved, the strip left the work under way a sliver — and dev-1, at a new card, read
  // as nobody's on the one sent back to it.
  it('folds the approved into one block, and says the card an agent holds besides the one it is at', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(about.ctx, runId, 't-about');
    await take('agent-1', 't-home');
    await reviewTask(lead(), runId, 't-about', 'changes', [{ note: 'Say it in Catalan too' }]);

    const { text } = shown(await monitorRun(lead(), runId));

    const at = text.findIndex(line => /● agent-1\s+◆ harness\s+on t-home\s*$/.test(line));
    expect(at).toBeGreaterThan(0);
    expect(text[at + 1]).toMatch(/holds ↺ t-about\s*$/);
  });

  // Carlos: a long message, opened, was cut by "…" — read whole, it wraps.
  it('opens a long message whole, in lines, never cut short', async () => {
    const runId = await open();
    const long = `The CDN is slow ${'and every picture waits on it '.repeat(12)}until the end`;
    await noteRun(lead(), runId, long);
    await noteRun(lead(), runId, long);
    const data = await monitorRun(lead(), runId, Number.MAX_SAFE_INTEGER);
    const folded = shown(data);
    const row = folded.text.findIndex(line => line.includes('×2 since'));
    const hit = folded.screen.hits.find(each => each.row === row && each.action.kind === 'event');
    if (hit?.action.kind !== 'event') {
      throw new Error('no line to click');
    }

    const opened = shown(data, { opened: new Set([hit.action.key]) }).text;
    const first = opened.findIndex(line => line.includes('⎿') && line.includes('The CDN is slow'));
    const part = opened.slice(first, first + 6).join(' ');
    expect(part).toContain('until the end');
    expect(opened[first]).not.toContain('…');
  });
});
