import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keepLook, keptLook, LOOKED_FOR_MS, lookKey } from './lookParts';
import { runPaths, taskPaths } from '../../runs/paths';
import { openRun } from '../../runs/run';
import { completeTask, takeTask } from '../../runs/tasks';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

// The sanity run: a lead looked after the designer, nothing changed between — 8 s for the same answer.
describe('a look kept for the same look asked again', () => {
  it('stands while the task, the run and the ask are as they were — and is a new look past its time', async () => {
    const plan = { ...benchPlan(), designReview: false };
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const taken = await takeTask(bench.agent('dev-1'), plan.runId, 't-home');
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");
    await completeTask(bench.agent('dev-1', { token: taken.token }), plan.runId, 't-home');
    const lead = bench.agent('lead');
    const { cache } = taskPaths(runPaths(bench.root, plan.runId), 't-home');

    const key = await lookKey(lead, plan.runId, 't-home', { paths: [] });
    expect(await lookKey(lead, plan.runId, 't-home', { paths: [] })).toBe(key);
    expect(await lookKey(lead, plan.runId, 't-home', { paths: ['/menu'] })).not.toBe(key);

    await keepLook(cache, key, 'the look', bench.now());
    expect(await keptLook(cache, key, bench.now())).toMatchObject({ text: 'the look' });
    expect(await keptLook(cache, 'another', bench.now())).toBeUndefined();

    // Its copy changed after it went to review: a new look.
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola!' };\n");
    expect(await lookKey(lead, plan.runId, 't-home', { paths: [] })).not.toBe(key);

    bench.advance(LOOKED_FOR_MS + 1);
    expect(await keptLook(cache, key, bench.now())).toBeUndefined();
  });
});
