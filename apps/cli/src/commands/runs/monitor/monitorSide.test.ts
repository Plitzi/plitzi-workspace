import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initialUi } from './monitorModel';
import { monitorScreen } from './monitorScreen';
import { THEMES } from './monitorTheme';
import { monitorRun } from '../../../runs/view/monitor';
import { makeBench } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

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
const shown = (data: Monitored): string =>
  monitorScreen(data, initialUi('advanced'), {
    width: 180,
    height: 60,
    now: bench.now(),
    theme: THEMES.dark,
    preview: { state: { kind: 'none' }, output: [] }
  })
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
