import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { openRun } from '../run';
import { checkTask } from './check';
import { CHECKED_FOR_MS } from './checked';
import { completeTask } from './complete';
import { takeTask } from './take';

import type { Bench } from '../../tests/runProject';
import type { CheckRunner } from '../checks';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

// The sanity run: task check passed in 9 s, and task complete ran it all again for 9 s more — nothing had changed.
describe('a passing check, kept for the complete after it', () => {
  const counted = () => {
    const calls: string[] = [];
    const checks: CheckRunner = dir => {
      calls.push(dir);

      return Promise.resolve({ ok: true, steps: [{ name: 'typecheck', ok: true }] });
    };

    return { calls, checks };
  };

  it('stands while nothing changed, and is said — the checks run again once a file did, or once it is old', async () => {
    const plan = benchPlan();
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const { calls, checks } = counted();
    const taken = await takeTask(bench.agent('dev-1', { checks }), plan.runId, 't-home');
    const dev = bench.agent('dev-1', { checks, token: taken.token });
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");

    expect((await checkTask(dev, plan.runId, 't-home')).ok).toBe(true);
    // Checked again with nothing changed: said again, not run — `fresh` runs it.
    expect((await checkTask(dev, plan.runId, 't-home')).checkedAt).toBeDefined();
    expect(calls).toHaveLength(1);
    expect((await checkTask(dev, plan.runId, 't-home', { fresh: true })).checkedAt).toBeUndefined();
    expect(calls).toHaveLength(2);
    const first = await completeTask(dev, plan.runId, 't-home');
    expect(calls).toHaveLength(2);
    expect(first.checkedAt).toBeDefined();
  });

  it('is not taken when the file changed after the check', async () => {
    const plan = benchPlan();
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const { calls, checks } = counted();
    const taken = await takeTask(bench.agent('dev-1', { checks }), plan.runId, 't-home');
    const dev = bench.agent('dev-1', { checks, token: taken.token });
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");
    await checkTask(dev, plan.runId, 't-home');
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola!' };\n");

    expect((await completeTask(dev, plan.runId, 't-home')).checkedAt).toBeUndefined();
    expect(calls).toHaveLength(2);
  });

  it('is not taken once it is older than it stands for', async () => {
    const plan = benchPlan();
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const { calls, checks } = counted();
    const taken = await takeTask(bench.agent('dev-1', { checks }), plan.runId, 't-home');
    const dev = bench.agent('dev-1', { checks, token: taken.token });
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");
    await checkTask(dev, plan.runId, 't-home');
    bench.advance(CHECKED_FOR_MS + 1);

    expect((await completeTask(dev, plan.runId, 't-home')).checkedAt).toBeUndefined();
    expect(calls).toHaveLength(2);
  });
});
