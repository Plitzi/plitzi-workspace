import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { takeOnLook } from './leads';
import { loadRun, openRun } from './run';
import { completeTask, findTask } from './tasks';
import { viewTask } from './taskStore';
import { setTeamAgent } from './team';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * The lead looked at a task in review and approved it, and the person following the run saw nobody take its
 * reviews — only `task next --take` said so. A look by whoever reviews it now takes the review.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

const inReview = async (withDesigner: boolean) => {
  await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
  if (withDesigner) {
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
  }

  const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
  const menu = await take('dev-1', 't-menu');
  await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
  await completeTask(menu.ctx, runId, 't-menu');

  return runId;
};

const viewOf = async (runId: string) => {
  const loaded = await loadRun(lead(), runId);

  return { loaded, view: await viewTask(loaded.paths, findTask(loaded, 't-menu')) };
};

describe('a look at a task in review', () => {
  it('takes the review for the lead, once', async () => {
    const runId = await inReview(false);

    const first = await viewOf(runId);
    expect(await takeOnLook(lead(), first.loaded, first.view)).toBe(true);
    const taken = await viewOf(runId);
    expect(taken.view.state.reviewer).toMatchObject({ by: 'lead', round: taken.view.state.round });
    expect(await takeOnLook(lead(), taken.loaded, taken.view)).toBe(false);
  });

  // A run's lead looked at a task's UI while its designer took the same review: the lead's approval was refused.
  it('takes a UI review nobody took for the lead who reads it, and nothing for one who does not review', async () => {
    const runId = await inReview(true);

    const { loaded, view } = await viewOf(runId);
    expect(view.state.design?.status).toBe('due');
    expect(await takeOnLook(bench.agent('dev-1'), loaded, view)).toBe(false);
    expect(await takeOnLook(lead(), loaded, view)).toBe(true);
    expect((await viewOf(runId)).view.state.design).toMatchObject({ status: 'due', by: 'lead' });
  });
});
