import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extendRun } from './extend';
import { STALL_MS } from './stalled';
import { allLocks, blockTask, claimFile } from './tasks';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
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
    // Changed in its copy: a block lets go only what it left as it was.
    await writeInCopy(about.work, 'src/space/theme.ts', 'export const theme = { warm: true };\n');
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
    expect(said?.text).toContain('plitzi task claim src/space/theme.ts --release');
    expect(said?.text).toContain('t-about is blocked: waits for t-theme');
  });
});

// A blocked task kept the file it took by turns to trace a bug, unchanged — and the task its block waited for needed it.
describe('a task blocked', () => {
  it('lets go of what it took by turns and left unchanged, to the task waiting for it, and keeps what it changed', async () => {
    const plan = benchPlan();
    const runId = await open({ ...plan, tasks: plan.tasks.filter(task => task.id === 't-about') });
    const about = await take('agent-1', 't-about');
    await claimFile(about.ctx, runId, 't-about', 'src/space/theme.ts');
    await claimFile(about.ctx, runId, 't-about', 'src/space/tokens.ts');
    await writeInCopy(about.work, 'src/space/tokens.ts', 'export const tokens = {};\n');

    expect(await blockTask(about.ctx, runId, 't-about', 'waits for the lead', 'lead')).toEqual({
      released: ['src/space/theme.ts'],
      granted: []
    });
    const held = (await allLocks(lead())).get('src/space/tokens.ts') ?? [];
    expect(held.map(each => each.task)).toEqual(['t-about']);
    expect((await allLocks(lead())).get('src/space/theme.ts') ?? []).toHaveLength(0);
  });
});

describe('a ready task held by a claim ahead of it', () => {
  // A run's t-crate-radio sat ready 22 minutes with three developers free: d-follow-names had claimed its test file, and
  // the lead's watch said only that the designers had nothing to take.
  it('is said to the lead at once, with the task that holds its file and what frees it', async () => {
    const plan = benchPlan();
    const runId = await open({ ...plan, tasks: plan.tasks.filter(task => task.id === 't-about') });
    const about = await take('agent-1', 't-about');
    await claimFile(about.ctx, runId, 't-about', 'src/space/theme.ts');
    await extendRun(
      lead(),
      runId,
      await bench.writePlan({
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
      })
    );

    const said = (await viewRun(lead(), runId)).attention.find(item => item.kind === 'held-ahead');
    expect(said).toMatchObject({ who: 'lead', task: 't-theme' });
    expect(said?.text).toContain('t-theme is ready, and none can take it: t-about holds src/space/theme.ts');
    expect(said?.text).toContain('free once t-about is approved');
  });
});
