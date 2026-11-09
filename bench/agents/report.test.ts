import { describe, expect, it } from 'vitest';

import { reportMarkdown, reportOf, wilson } from './report';

import type { RunMetrics } from './metrics';
import type { RunResult } from './report';

const metrics = (netTokens: number, overrides: Partial<RunMetrics> = {}): RunMetrics => ({
  success: true,
  tokensIn: netTokens,
  tokensOut: 0,
  netTokens,
  turns: 3,
  refusals: 0,
  hallucinations: 0,
  wasteShare: 0,
  ceilingHit: false,
  ...overrides
});

const result = (model: string, task: string, run: number, value: RunMetrics): RunResult => ({
  model,
  context: 'core',
  task,
  run,
  check: { ok: value.success },
  metrics: value
});

describe('the floor', () => {
  it('is the cheapest configuration as good as the reference', () => {
    const { configurations, floor } = reportOf([
      result('claude:big', 'a', 1, metrics(9000)),
      result('claude:big', 'b', 1, metrics(9000)),
      result('claude:small', 'a', 1, metrics(3000)),
      result('claude:small', 'b', 1, metrics(3000)),
      result('opencode:tiny', 'a', 1, metrics(1000, { hallucinations: 2 })),
      result('opencode:tiny', 'b', 1, metrics(1000, { success: false, failedBecause: 'no' }))
    ]);

    expect(floor).toBe('claude:small @ core');
    expect(configurations.find(entry => entry.configuration === 'opencode:tiny @ core')?.belowFloorBecause).toEqual([
      'succeeds less',
      'hallucinates more',
      'never did b'
    ]);
  });

  // A loop that ends well is still a loop: past three times the reference's median, a run is a failure.
  it('fails a run that took more than three times the reference on its task', () => {
    const { configurations } = reportOf([
      result('claude:big', 'a', 1, metrics(1000)),
      result('claude:small', 'a', 1, metrics(5000))
    ]);

    expect(configurations.find(entry => entry.configuration === 'claude:small @ core')).toMatchObject({
      successRate: 0,
      belowFloorBecause: ['succeeds less', 'never did a']
    });
  });

  it('holds waste to its bounds, on average and on a task', () => {
    const { configurations } = reportOf([
      result('claude:big', 'a', 1, metrics(1000)),
      result('claude:small', 'a', 1, metrics(1000, { wasteShare: 0.4 }))
    ]);

    expect(configurations[1]?.belowFloorBecause).toEqual(['wastes too much on average', 'wastes too much on a task']);
  });
});

describe('the spread', () => {
  // Five runs that all succeeded are not certainty: the interval says how far the rate could be.
  it('gives every rate its 95% Wilson interval, never a certainty from a few runs', () => {
    const [low, high] = wilson(5, 5);

    expect(high).toBe(1);
    expect(low).toBeCloseTo(0.566, 3);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });

  it('says the net tokens from the first to the third quartile', () => {
    const { configurations } = reportOf(
      [1000, 2000, 3000, 4000, 5000].map(tokens => result('claude:big', 'a', tokens, metrics(tokens)))
    );

    expect(configurations[0]?.spread.netTokens).toEqual([2000, 4000]);
  });
});

describe('where it broke', () => {
  it('names each task a configuration failed, with why, most common first', () => {
    const results = [
      result('claude:big', 'a', 1, metrics(1000)),
      result('claude:small', 'a', 1, metrics(1000, { success: false, failedBecause: 'no heading' })),
      result('claude:small', 'a', 2, metrics(1000, { success: false, failedBecause: 'no class' })),
      result('claude:small', 'a', 3, metrics(1000, { success: false, failedBecause: 'no class' }))
    ];

    expect(reportOf(results).configurations[1]?.tasks).toEqual([
      {
        task: 'a',
        runs: 3,
        successes: 0,
        failedBecause: [
          { why: 'no class', runs: 2 },
          { why: 'no heading', runs: 1 }
        ]
      }
    ]);
    expect(reportMarkdown(results)).toContain('- **a**: 0/3 — no class (2); no heading (1)');
  });
});
