import { describe, expect, it } from 'vitest';

import { reportOf } from './report';

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
