import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STANDING_AGAIN_MS, waitForLead } from './leadWatch';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { completeTask } from '../tasks';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

/** What the lead's watch hands it of t-about's review, as `run watch` would. */
const reviewOf = async (): Promise<string[]> =>
  (await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 })).fresh
    .map(item => item.text)
    .filter(text => text.includes('t-about is in review'));

// A run's escalation was shown once, by a watch whose output its lead never read, and waited 43 minutes until the person
// saw it on the monitor.
describe('what still waits on the lead', () => {
  it('is said again while it stands, a while after it was shown — and not before', async () => {
    await open(benchPlan());
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    await completeTask(about.ctx, 'es-launch', 't-about');
    expect(await reviewOf()).toEqual([expect.stringMatching(/^t-about is in review, yours to review/)]);
    expect(await reviewOf()).toEqual([]);

    bench.advance(STANDING_AGAIN_MS);
    expect(await reviewOf()).toEqual([
      expect.stringMatching(/^Still waiting on you since \d\d:\d\d UTC — t-about is in review, yours to review/)
    ]);
    expect(await reviewOf()).toEqual([]);
  });
});
