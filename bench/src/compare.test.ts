import { describe, expect, it } from 'vitest';

import { compareRuns } from './compare';

import type { PhaseResult, TargetResult } from './measure';

const phase = (rps: number, maxMb: number): PhaseResult => ({
  scenario: 'page',
  concurrency: 10,
  requests: rps * 10,
  rps,
  errors: 0,
  unexpected: {},
  bytesPerResponse: 5000,
  latencyMs: { mean: 10, p50: 10, p90: 20, p99: 30, max: 40 },
  cpuMsPerRequest: 4,
  cpuCores: 0.25,
  memoryMb: { mean: maxMb, max: maxMb }
});

const target = (overrides: Partial<TargetResult>): TargetResult => ({
  target: 'blog',
  runner: 'tsx',
  status: 'ok',
  bootMs: 3000,
  idleMb: 60,
  retainedMb: 80,
  phases: [phase(100, 100)],
  oomKilled: false,
  ...overrides
});

describe('compareRuns', () => {
  it('calls fewer requests a second a regression, and less memory an improvement', () => {
    const changes = compareRuns([target({})], [target({ phases: [phase(80, 70)] })], 0.1);

    expect(changes).toEqual([
      expect.objectContaining({ metric: 'req/s', verdict: 'regression', worseBy: 0.2 }),
      expect.objectContaining({ metric: 'max MB', verdict: 'improvement', worseBy: -0.3 })
    ]);
  });

  it('ignores what moved less than the tolerance, or less than a metric’s noise floor', () => {
    const changes = compareRuns([target({})], [target({ bootMs: 3100, phases: [phase(95, 101)] })], 0.1);

    expect(changes).toEqual([]);
  });

  it('calls a target that ran before and fails now a regression whatever its numbers', () => {
    const changes = compareRuns([target({})], [target({ status: 'failed', failure: 'OOM', phases: [] })], 0.1);

    expect(changes).toEqual([expect.objectContaining({ verdict: 'regression', metric: 'status (OOM)' })]);
  });

  it('compares whole-run memory only between runs that did the same work', () => {
    const extraPhase = { ...phase(100, 100), scenario: 'sdk-js' };
    const changes = compareRuns(
      [target({})],
      [target({ retainedMb: 200, phases: [phase(100, 100), extraPhase] })],
      0.1
    );

    expect(changes).toEqual([]);
  });

  it('says nothing about a target the baseline never measured, or measured under another runner', () => {
    expect(compareRuns([], [target({})], 0.1)).toEqual([]);
    expect(compareRuns([target({})], [target({ runner: 'node', phases: [phase(10, 300)] })], 0.1)).toEqual([]);
  });
});
