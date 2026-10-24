import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { loadRun, openRun } from './run';
import { benchPlan, makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * What the run made from a plan stays when the plan is amended: encore-2's amend of a stage dropped the tasks of tests
 * the run had made after its developer tasks — "nobody had taken them" — with the proposals sent to them.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

describe('an amended plan and the tasks the run made from it', () => {
  it('keeps the task of tests of a developer task the plan keeps — and drops it with its task', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = [{ ...plan.tasks[0], id: 't-price', files: ['src/lib/price.ts'], acceptance: ['Prices in euros'] }];
    await bench.write('src/lib/price.ts', 'export const price = (cents: number) => cents / 100;\n');
    await bench.writeTeam({
      version: 1,
      agents: [
        { name: 'dev', roles: ['developer'] },
        { name: 'test', roles: ['tester'] }
      ]
    });
    const file = await bench.writePlan(plan);
    const { runId } = (await openRun(lead(), file)).checked;
    const ids = async () => (await loadRun(lead(), runId)).tasks.map(task => task.id);
    expect(await ids()).toEqual(['t-price', 't-price-tests']);

    plan.tasks = [{ ...plan.tasks[0], acceptance: ['Prices in euros, two decimals'] }];
    const amended = await amendRun(lead(), runId, await bench.writePlan(plan));

    expect(amended.removed).toBeUndefined();
    expect(await ids()).toEqual(['t-price', 't-price-tests']);
  });
});
