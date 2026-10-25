import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extendRun } from './extend';
import { STALL_MS } from './stalled';
import { blockTask, claimFile } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

describe('a run that stands still', () => {
  // A run stood still past ten minutes while its lead's watch said "nothing new": a ready task offered to nobody, a file
  // of it held by a task blocked waiting for it. The person found it; the lead must.
  it('is said to the lead with what holds each task, once nothing has moved for a while', async () => {
    const plan = benchPlan();
    const runId = await open({ ...plan, tasks: plan.tasks.filter(task => task.id === 't-about') });
    const about = await take('agent-1', 't-about');
    await claimFile(about.ctx, runId, 't-about', 'src/space/theme.ts');
    const theme = {
      version: 1 as const,
      runId: 'es-launch-2',
      goal: 'A warmer theme',
      tasks: [
        {
          id: 't-theme',
          title: 'Warmer ink',
          files: ['src/space/theme.ts'],
          dependsOn: [],
          priority: 'high' as const,
          estimateMinutes: 10,
          acceptance: ['The ink is warmer']
        }
      ]
    };
    await extendRun(lead(), runId, await bench.writePlan(theme));
    await blockTask(about.ctx, runId, 't-about', 'waits for t-theme', 'lead');

    const stalledNow = async () => (await viewRun(lead(), runId)).attention.find(item => item.kind === 'stalled');
    expect(await stalledNow()).toBeUndefined();

    bench.advance(STALL_MS + 60_000);
    const said = await stalledNow();
    expect(said?.who).toBe('lead');
    expect(said?.text).toContain('The run stands still: nothing has moved for 6 min');
    expect(said?.text).toContain(
      't-theme is ready, offered to nobody: src/space/theme.ts is held by t-about — itself blocked (waits for t-theme)'
    );
    expect(said?.text).toContain('plitzi task release src/space/theme.ts');
    expect(said?.text).toContain('t-about is blocked: waits for t-theme');
  });
});
