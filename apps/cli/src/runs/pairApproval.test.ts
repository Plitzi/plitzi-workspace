import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { completeTask, reviewTask } from './tasks';
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

const { lead, open, refusal, take } = runSteps(() => bench);

// Two tasks in review each read a file the other made — an agreed import, a module moved: one at a time neither passed
// the project's checks, so neither could ever be approved.
describe('two tasks in review that read each other’s work', () => {
  it('are approved as one change with --with, after the approval alone says how', async () => {
    const runId = await open(benchPlan());
    const home = await take('agent-3', 't-home');
    const menu = await take('agent-1', 't-menu');
    const about = await take('agent-2', 't-about');
    await writeInCopy(
      menu.work,
      'src/space/theme.ts',
      "// The menu reads the card's colour.\nimport { tokens } from './tokens.ts';\n\nexport const theme = { card: { color: tokens.ink } };\n"
    );
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      'export const menu = {}; // HAS:menuPart NEEDS:aboutPart\n'
    );
    await writeInCopy(
      about.work,
      'src/space/pages/about.ts',
      'export const about = {}; // HAS:aboutPart NEEDS:menuPart\n'
    );
    await completeTask(menu.ctx, runId, 't-menu', {
      knownFailure: { why: 'author: reads aboutPart', fixedBy: 't-about' }
    });
    await completeTask(about.ctx, runId, 't-about', {
      knownFailure: { why: 'author: reads menuPart', fixedBy: 't-menu' }
    });

    // The run's theme moves after t-menu went to review: its change to it is put together with the run's, and checked.
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = {};\n');
    await writeInCopy(
      home.work,
      'src/space/theme.ts',
      "import { tokens } from './tokens.ts';\n\nexport const theme = { card: { color: tokens.ink }, warm: true };\n"
    );
    await completeTask(home.ctx, runId, 't-home');
    await reviewTask(lead(), runId, 't-home', 'approve', []);

    expect((await refusal(reviewTask(lead(), runId, 't-menu', 'approve', []))).message).toContain(
      'approve the two as one change: plitzi task review t-menu --approve --with <that task>'
    );
    expect(
      (await refusal(reviewTask(lead(), runId, 't-menu', 'changes', [{ note: 'x' }], 'refuse', { with: 't-about' })))
        .message
    ).toContain('--with approves two tasks as one change');

    const approved = await reviewTask(lead(), runId, 't-menu', 'approve', [], 'refuse', { with: 't-about' });
    expect(approved.merged).toEqual(expect.arrayContaining(['src/space/pages/menu.ts', 'src/space/theme.ts']));
    expect(approved.with).toEqual({ task: 't-about', merged: ['src/space/pages/about.ts'] });
    const statuses = new Map((await viewRun(lead(), runId)).tasks.map(task => [task.id, task.status] as const));
    expect([statuses.get('t-menu'), statuses.get('t-about')]).toEqual(['done', 'done']);
  });
});
