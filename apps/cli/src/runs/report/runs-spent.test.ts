import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openRun, readRunLog, loadRun } from '../run';
import { spentOf, spentPerMinute } from './spent';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { scopePlan, SCOPE_SPIKE } from '../plan/spike';
import { completeResearch, completeTask, reviewTask, takeTask } from '../tasks';

import type { Bench } from '../../tests/runProject';
import type { HarnessUsage } from '../harness';
import type { RunContext } from '../run';

/**
 * A run's tester read 30M tokens, nearly all of it reviewing, and no round's report held it: what every agent's
 * harness spent is kept as each piece of its work ends — a task completed, a review decided — the lead's too.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

/**
 * A harness that read `read` tokens in `turns` turns — a tenth of them new context, a hundredth its answers, the rest its
 * context read again — in the window's last minute, its context `context`, a dollar a million tokens unless `unpriced`,
 * and the windows it was asked for.
 */
const harness =
  (read: number, turns: number, context: number, asked: { from: string; to: string }[], unpriced = false) =>
  (window: { from: string; to: string }): Promise<HarnessUsage | undefined> => {
    asked.push({ from: window.from, to: window.to });

    return Promise.resolve({
      harness: 'claude',
      model: 'claude-sonnet-5-5',
      turns,
      input: 0,
      cacheRead: read * 0.89,
      cacheWrite: read * 0.1,
      output: read * 0.01,
      processed: read,
      contextAtEnd: context,
      ...(unpriced ? {} : { cost: read / 1_000_000 }),
      minutes: [{ at: window.to.slice(0, 16), tokens: read }],
      heaviest: [],
      plitziRead: []
    });
  };

describe('what each agent spent', () => {
  it('is kept as a task completes and as a review is decided, each from the last it kept', async () => {
    const plan = benchPlan();
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const devWindows: { from: string; to: string }[] = [];
    const dev = (token?: string): RunContext =>
      bench.agent('agent-1', { spent: harness(400_000, 12, 70_000, devWindows), ...(token ? { token } : {}) });
    const lead = bench.agent('lead', { spent: harness(900_000, 20, 150_000, [], true) });

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
      {
        agent: 'lead',
        pieces: 1,
        tasks: ['t-home'],
        sessions: 1,
        turns: 20,
        input: 90_000,
        output: 9_000,
        cached: 801_000,
        context: 150_000,
        model: 'claude-sonnet-5-5'
      },
      {
        agent: 'agent-1',
        pieces: 2,
        // Two rounds of one task: one task.
        tasks: ['t-home'],
        sessions: 1,
        turns: 24,
        input: 80_000,
        output: 8_000,
        cached: 712_000,
        context: 70_000,
        cost: 0.8,
        model: 'claude-sonnet-5-5'
      }
    ]);
    // The lead's review on a model with no price: no cost of its, and none of the run's.
    expect(spentOf(log)[0]).not.toHaveProperty('cost', expect.any(Number));
    // A minute apart: the first task's and the review's, then the second round's — the chart's last three minutes.
    expect(spentPerMinute(log, bench.now(), 3)).toEqual([0, 1_300_000, 400_000]);
  });

  // A run's scope — every page swept — was counted in its lead's first review after it: $3.77 of a five-minute review.
  it('is kept as research ends: what finding it out cost, apart from the reviews after it', async () => {
    const lead = bench.agent('lead', { spent: harness(2_000_000, 40, 120_000, []) });
    await openRun(lead, await bench.writePlan(scopePlan('es-launch', 'Translate the site into Spanish')));
    await completeResearch(lead, 'es-launch', SCOPE_SPIKE, 'Four pages, nothing else');

    const log = await readRunLog((await loadRun(lead, 'es-launch')).paths);
    expect(log.filter(entry => entry.action === 'spent').map(entry => [entry.by, entry.task, entry.piece])).toEqual([
      ['lead', SCOPE_SPIKE, 'spike']
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
