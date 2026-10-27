import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { liveVerb } from './monitorModel';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { logRun, openRun } from '../../runs/run';
import { completeTask, takeNext } from '../../runs/tasks';
import { SCOUT, team, TESTERS } from '../../tests/reviewerSteps';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { RunPlan } from '../../runs/model';
import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

// Carlos: on the monitor a tester and a scout said only their card, where a developer said what it was at.
describe('what a reviewer and a scout are at, on the monitor', () => {
  it('says the step a tester gave its review', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = { title: "Inicio" };\n');
    await completeTask(home.ctx, runId, 't-home');
    await takeNext(bench.agent('test-1'), runId, 'tester');
    await logRun(bench.agent('test-1'), runPaths(bench.root, runId), {
      action: 'progress',
      task: 't-home',
      kind: 'review',
      step: 'measuring the hero at 390'
    });

    const row = (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'test-1');
    expect(row?.doing).toContain('reviews t-home — measuring the hero at 390');
  });

  it('says the step a scout gave its research card, a scout finding out', async () => {
    await bench.writeTeam(team(SCOUT));
    const plan: RunPlan = benchPlan();
    plan.tasks = [{ ...plan.tasks[0], id: 's-words', title: 'The words', files: [], spike: 'which words' }];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    await logRun(bench.agent('scout-1'), runPaths(bench.root, runId), {
      action: 'progress',
      task: 's-words',
      kind: 'spike',
      step: 'reading the original menu'
    });

    const row = (await monitorRun(lead(), runId)).agents.find(agent => agent.agent === 'scout-1');
    expect(row?.doing).toContain('finds out s-words — reading the original menu');
    expect(row && liveVerb(row)).toBe('Finding out');
  });
});
