import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extendRun } from './extend';
import { showTask } from './show';
import { completeTask, reviewTask } from './tasks';
import { makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

// encore-14's tester read shows.ts, in the project before the run, as "(added)": a stage's task, its file in no base.
describe('a stage’s task, shown once approved', () => {
  it('says a file the project had as changed, read against the project’s own version', async () => {
    const runId = await open();
    const stage: RunPlan = {
      version: 1,
      runId: 'es-theme',
      goal: 'A warmer ink',
      tasks: [
        {
          id: 't-ink',
          title: 'A warmer ink',
          files: ['src/space/tokens.ts'],
          dependsOn: [],
          priority: 'medium',
          estimateMinutes: 10,
          acceptance: ['The ink is warm'],
          tests: false
        }
      ]
    };
    await extendRun(lead(), runId, await bench.writePlan(stage));
    const ink = await take('agent-1', 't-ink');
    await writeInCopy(ink.work, 'src/space/tokens.ts', "export const tokens = { ink: '#3b2a1a' };\n");
    await completeTask(ink.ctx, runId, 't-ink');
    await reviewTask(lead(), runId, 't-ink', 'approve', []);

    expect((await showTask(lead(), runId, 't-ink')).files.map(each => [each.file, each.change])).toEqual([
      ['src/space/tokens.ts', 'changed']
    ]);
  });
});
