import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { onMouse } from './monitorInput';
import { initialUi, momentKey } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../../runs/view/monitor';
import { makeBench } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

import type { MonitorUi, StreamShown } from './monitorModel';
import type { Spent } from '../../../runs/report/spent';
import type { Monitored } from '../../../runs/view/monitor';
import type { Bench } from '../../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open } = runSteps(() => bench);

/** The advanced panel's text at a wide terminal's size, a row a line. */
const shown = (data: Monitored, ui: Partial<MonitorUi> = {}, stream?: StreamShown): string =>
  monitorScreen(
    data,
    { ...initialUi('advanced'), ...ui },
    {
      width: 180,
      height: 60,
      now: bench.now(),
      theme: THEMES.dark,
      preview: { state: { kind: 'none' }, output: [] },
      ...(stream === undefined ? {} : { stream })
    }
  )
    .canvas.text()
    .join('\n');

/** A run's agent-1 after two tasks: 97 % of its 2.1M its context read again. */
const agent: Spent = {
  agent: 'agent-1',
  pieces: 2,
  tasks: ['t-home', 't-about'],
  sessions: 2,
  turns: 28,
  input: 59_630,
  output: 11_363,
  cached: 2_076_473,
  context: 96_681
};

describe("the sidebar's spend", () => {
  it('says under each agent what its figure is — 97 % of a run’s 2.4M was its context read again', async () => {
    const data = await monitorRun(lead(), await open());
    const text = shown({ ...data, spend: [agent] });

    expect(text).toMatch(/agent-1\s+█+░*\s+2\.1M/);
    expect(text).toContain('in 60k · out 11k · cache 2.1M');
  });

  // Carlos, beside the mockup: the chart, how much was cached and what it cost were missing.
  it('charts the last half hour, says how much was read again, and what it cost when every model has a price', async () => {
    const data = await monitorRun(lead(), await open());
    const text = shown({
      ...data,
      // The lead's in and out the more, its cost the less: the bars by what they say, the costlier first.
      spend: [
        { ...agent, cost: 1.84 },
        { ...agent, agent: 'lead', input: 80_000, output: 20_000, cached: 900_000, cost: 0.92 }
      ],
      perMinute: [...new Array<number>(28).fill(0), 1000, 4000]
    });

    expect(text).toMatch(/Spend\s+\$2\.76/);
    expect(text).toMatch(/▁+▂█\s+last 30 min/);
    expect(text).toMatch(/3\.1M tokens\s+95% cached/);
    expect(text).toMatch(/agent-1\s+█+\s+\$1\.84[^]*lead\s+█+░+\s+\$0\.92/);
  });
});

// Carlos: a headless agent's output is its last answer alone — what it says and does, followed in the sidebar.
describe("the sidebar's stream of the agent followed", () => {
  // Carlos: newest last, a whole opened near the end ran past the bottom and the scroll fought the moments coming.
  it('says what the agent said and did, newest first, under the spend — and why there is none to read', async () => {
    const data = await monitorRun(lead(), await open());
    const agent = data.agents.find(each => each.kind === 'agent')?.agent ?? 'agent-1';
    const text = shown(
      { ...data, spend: [] },
      { agent },
      {
        agent,
        moments: [
          { at: 't1', kind: 'said', text: 'Checking the charts' },
          { at: 't2', kind: 'tool', text: 'Bash npx plitzi task check' },
          { at: 't3', kind: 'result', text: 'fail 1', failed: true }
        ]
      }
    );

    expect(text).toContain(`Stream · ${agent}`);
    expect(text).toMatch(/✗ fail 1[\s\S]*▸ Bash npx plitzi task check[\s\S]*› Checking the charts/);
    expect(text.indexOf('Spend')).toBeLessThan(text.indexOf('Stream ·'));
    expect(shown(data, { agent }, { agent, problem: 'no Claude Code session of it on this machine yet' })).toContain(
      'no Claude Code session of it on this machine yet'
    );
    expect(shown(data)).not.toContain('Stream ·');
  });

  // Carlos: a moment cut on its row could not be read — a click on it opens its whole under it.
  it('opens a moment with more to say by a click on it, its whole under its line — and closes it again', async () => {
    const data = await monitorRun(lead(), await open());
    const agent = data.agents.find(each => each.kind === 'agent')?.agent ?? 'agent-1';
    const moment = {
      at: 't1',
      kind: 'said' as const,
      text: 'Checking the charts',
      whole: 'Checking the charts\nthen the rooms, read once'
    };
    const screen = (ui: Partial<MonitorUi>) =>
      monitorScreen(
        { ...data, spend: [] },
        { ...initialUi('advanced'), agent, ...ui },
        {
          width: 180,
          height: 60,
          now: bench.now(),
          theme: THEMES.dark,
          preview: { state: { kind: 'none' }, output: [] },
          stream: { agent, moments: [moment] }
        }
      );

    const closed = screen({});
    expect(closed.canvas.text().join('\n')).not.toContain('then the rooms, read once');
    const hit = closed.hits.find(each => each.action.kind === 'moment');
    const opened =
      hit &&
      onMouse(
        { ...initialUi('advanced'), agent },
        { button: 0, row: hit.row, col: hit.from + 1 },
        { ...closed, needs: [], palette: () => [], preview: 'none' }
      );
    expect(opened?.streamOpened.has(momentKey(moment))).toBe(true);
    const text = screen({ streamOpened: opened?.streamOpened }).canvas.text().join('\n');
    expect(text).toMatch(/▾ Checking the charts\s*\n\s*Checking the charts\s*\n\s*then the rooms, read once/);
  });

  // Carlos: opening a call's arrow showed what it asked, never what it answered — two arrows to open for one call.
  // …and two arrows for one call: the answer's own arrow is gone, the call's opens both.
  it('opens a tool call with its answer by one arrow — paired by the call, another answering between them', async () => {
    const data = await monitorRun(lead(), await open());
    const agent = data.agents.find(each => each.kind === 'agent')?.agent ?? 'agent-1';
    const asked = { at: 't1', kind: 'tool' as const, text: 'Bash npx plitzi task check', call: 'c1' };
    const moments = [
      asked,
      { at: 't1', kind: 'tool' as const, text: 'Read src/a.ts', call: 'c2' },
      {
        at: 't2',
        kind: 'result' as const,
        text: 'export const a',
        whole: 'export const a\nexport const b',
        call: 'c2'
      },
      { at: 't2', kind: 'result' as const, text: 'fail 1', whole: 'fail 1\n  ✗ the charts read once', call: 'c1' }
    ];
    const screen = (ui: Partial<MonitorUi>) =>
      monitorScreen(
        { ...data, spend: [] },
        { ...initialUi('advanced'), agent, ...ui },
        {
          width: 180,
          height: 60,
          now: bench.now(),
          theme: THEMES.dark,
          preview: { state: { kind: 'none' }, output: [] },
          stream: { agent, moments }
        }
      );

    const closed = screen({});
    const closedText = closed.canvas.text().join('\n');
    expect(closedText).toMatch(/⎿ fail 1/);
    expect(closedText).toMatch(/⎿ export const a/);
    expect(closedText.match(/▸/g)).toHaveLength(2);
    // A click on the answer opens its call: the one key both rows share.
    const keys = closed.hits.flatMap(each => (each.action.kind === 'moment' ? [each.action.key] : []));
    expect(new Set(keys).size).toBe(2);
    // The call says nothing more than its line: it opens for its answer.
    const hit = closed.hits.find(each => each.action.kind === 'moment' && each.action.key === momentKey(asked));
    const opened =
      hit &&
      onMouse(
        { ...initialUi('advanced'), agent },
        { button: 0, row: hit.row, col: hit.from + 1 },
        { ...closed, needs: [], palette: () => [], preview: 'none' }
      );
    const text = screen({ streamOpened: opened?.streamOpened }).canvas.text().join('\n');
    expect(text).toMatch(/▾ Bash npx plitzi task check/);
    expect(text).toMatch(/⎿ fail 1\s*\n\s*fail 1\s*\n\s*✗ the charts read once/);
    expect(text).not.toContain('export const b');
  });

  // Carlos: the stream took the height left under many tasks, could not be scrolled, and the sidebar was narrow.
  it('takes the height down to the run, the tasks a third at most — scrolled back by the wheel — wider with e', async () => {
    const data = await monitorRun(lead(), await open());
    const agent = data.agents.find(each => each.kind === 'agent')?.agent ?? 'agent-1';
    const [task] = data.view.tasks;
    const many = {
      ...data,
      spend: [],
      view: { ...data.view, tasks: Array.from({ length: 30 }, (_, at) => ({ ...task, id: `t-${String(at)}` })) }
    };
    const moments = Array.from({ length: 60 }, (_, at) => ({
      at: String(at),
      kind: 'said' as const,
      text: `moment ${String(at)}`
    }));
    const said = (text: string) => [...text.matchAll(/› moment (\d+)/g)].map(match => Number(match[1]));

    const live = said(shown(many, { agent }, { agent, moments }));
    expect(live.length).toBeGreaterThanOrEqual(20);
    expect(live[0]).toBe(59);
    expect(live.at(-1)).toBeLessThan(live[0]);

    const back = shown(many, { agent, streamBack: 10 }, { agent, moments });
    expect(said(back)[0]).toBe(49);
    expect(back).toContain('10 newer above · wheel');

    // Wider: the stream's column starts further left.
    const column = (text: string) =>
      text
        .split('\n')
        .find(line => line.includes('Stream ·'))
        ?.indexOf('Stream ·') ?? 0;
    expect(column(shown(many, { agent, sideWide: true }, { agent, moments }))).toBeLessThan(
      column(shown(many, { agent }, { agent, moments }))
    );
  });
});
