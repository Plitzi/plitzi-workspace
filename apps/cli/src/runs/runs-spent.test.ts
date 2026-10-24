import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openRun, readRunLog, loadRun } from './run';
import { spentOf } from './spent';
import { completeTask, reviewTask, takeTask } from './tasks';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';

import type { HarnessUsage } from './harness';
import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

/**
 * encore-2's tester read 30M tokens, nearly all of it reviewing, and no round's report held it: what every agent's
 * harness spent is kept as each piece of its work ends — a task completed, a review decided — the lead's too.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

/** A harness that read `read` tokens in `turns` turns, its context `context` — and the windows it was asked for. */
const harness =
  (read: number, turns: number, context: number, asked: { from: string; to: string }[]) =>
  (window: { from: string; to: string }): Promise<HarnessUsage | undefined> => {
    asked.push({ from: window.from, to: window.to });

    return Promise.resolve({
      harness: 'claude',
      model: 'claude-sonnet-5-5',
      turns,
      input: 0,
      cacheRead: read,
      cacheWrite: 0,
      output: 0,
      processed: read,
      contextAtEnd: context,
      heaviest: [],
      plitziRead: []
    });
  };

describe('what each agent spent', () => {
  it('is kept as a task completes and as a review is decided, each from the last it kept', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const devWindows: { from: string; to: string }[] = [];
    const dev = (token?: string): RunContext =>
      bench.agent('agent-1', { spent: harness(400_000, 12, 70_000, devWindows), ...(token ? { token } : {}) });
    const lead = bench.agent('lead', { spent: harness(900_000, 20, 150_000, []) });

    const home = await takeTask(dev(), 'es-launch', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = {};\n');
    bench.advance(60_000);
    await completeTask(dev(home.token), 'es-launch', 't-home');
    await reviewTask(lead, 'es-launch', 't-home', 'changes', [{ note: 'The title again' }]);
    bench.advance(60_000);
    await completeTask(dev(home.token), 'es-launch', 't-home');

    const log = await readRunLog((await loadRun(bench.agent('lead'), 'es-launch')).paths);
    const kept = log.filter(entry => entry.action === 'spent');
    expect(kept.map(entry => [entry.by, entry.task, entry.piece])).toEqual([
      ['agent-1', 't-home', 'task'],
      ['lead', 't-home', 'review'],
      ['agent-1', 't-home', 'task']
    ]);
    // Its second window starts where its first ended: nothing counted twice.
    expect(devWindows[1]?.from).toBe(kept[0]?.at);
    expect(spentOf(log)).toEqual([
      { agent: 'lead', pieces: 1, turns: 20, read: 900_000, context: 150_000, model: 'claude-sonnet-5-5' },
      { agent: 'agent-1', pieces: 2, turns: 24, read: 800_000, context: 70_000, model: 'claude-sonnet-5-5' }
    ]);
  });

  it('is not kept where the harness is not read', async () => {
    await openRun(bench.agent('lead'), await bench.writePlan(benchPlan()));
    const home = await takeTask(bench.agent('agent-1'), 'es-launch', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = {};\n');
    await completeTask(bench.agent('agent-1', { token: home.token }), 'es-launch', 't-home');

    const log = await readRunLog((await loadRun(bench.agent('lead'), 'es-launch')).paths);
    expect(log.some(entry => entry.action === 'spent')).toBe(false);
  });
});
