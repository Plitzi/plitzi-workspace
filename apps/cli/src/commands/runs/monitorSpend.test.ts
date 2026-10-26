import { describe, expect, it } from 'vitest';

import { sortSpend, sparkline, spendTable, spentInAll, tokensShort } from './monitorSpend';
import { cachedShare, costInAll, costShort } from '../../runs/spent';

import type { Spent } from '../../runs/spent';

/** A run's tester after one spec: 17 turns, 92 % of what it read its context again. */
const tester: Spent = {
  agent: 'test-1',
  pieces: 1,
  tasks: ['t-player'],
  sessions: 1,
  turns: 17,
  input: 66_968,
  output: 6_197,
  cached: 1_253_308,
  context: 92_877
};
const developer: Spent = {
  agent: 'dev-1',
  pieces: 2,
  tasks: ['t-player', 't-queue'],
  sessions: 2,
  turns: 7,
  input: 40_000,
  output: 3_000,
  cached: 370_000,
  context: 140_000
};

describe("the monitor's spend", () => {
  // Carlos: the spend said in, out and cached apart, and nowhere what the run cost in the harness — the sum.
  it('says tokens in, out and cached apart and their total, a context past a fresh start marked', () => {
    const { rows, all } = spendTable([tester, developer], new Map([['dev-1', 100_000]]), 'spent');

    expect(rows.map(row => [row.agent, row.total, row.perSession, row.pastFresh])).toEqual([
      ['test-1', 1_326_473, 73_165, false],
      ['dev-1', 413_000, 21_500, true]
    ]);
    // t-player is dev-1's and test-1's: once for the run, every agent's spend on it in what a task cost.
    expect(all).toMatchObject({ pieces: 3, tasks: 2, sessions: 3, turns: 24, total: 1_739_473, perTask: 58_083 });
    expect(spentInAll([tester, developer])).toBe(1_739_473);
  });

  // Carlos: every agent of a run starts fresh after each piece, and the panel said "past 100k: started fresh next".
  it('marks no context of an agent that starts fresh after every piece, however large', () => {
    expect(spendTable([{ ...developer, context: 400_000 }], new Map(), 'spent').rows[0]?.pastFresh).toBe(false);
  });

  it('sorts by what costs, a session, a task, what was read again, the context, the name', () => {
    expect(sortSpend([tester, developer], 'session').map(each => each.agent)).toEqual(['test-1', 'dev-1']);
    expect(sortSpend([tester, developer], 'context').map(each => each.agent)).toEqual(['dev-1', 'test-1']);
    expect(sortSpend([tester, developer], 'agent').map(each => each.agent)).toEqual(['dev-1', 'test-1']);
  });

  it('says tokens in a few characters', () => {
    expect([950, 72_400, 4_800_000, 12_000_000].map(tokensShort)).toEqual(['950', '72k', '4.8M', '12M']);
  });

  // The mockup's spend said what the run cost and how much of it was cached; a model with no price says none.
  it('says the cost in all only when every agent has one, and the share read again', () => {
    expect(
      costInAll([
        { ...tester, cost: 0.3 },
        { ...developer, cost: 0.12 }
      ])
    ).toBeCloseTo(0.42);
    expect(costInAll([{ ...tester, cost: 0.3 }, developer])).toBeUndefined();
    expect(costInAll([])).toBeUndefined();
    expect(cachedShare([tester, developer])).toBe(93);
    expect([0.004, 0.42, 12.44, 130.2].map(costShort)).toEqual(['<$0.01', '$0.42', '$12.4', '$130']);
  });

  it('charts the minutes a column each, put together when there are fewer columns, none drawn as nothing', () => {
    expect(sparkline([0, 1000, 4000, 8000], 4)).toEqual([0, 1, 4, 8]);
    expect(sparkline([0, 1000, 3000, 8000], 2)).toEqual([1, 8]);
    expect(sparkline([0, 0], 5)).toEqual([0, 0]);
  });
});
