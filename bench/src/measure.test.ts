import { describe, expect, it } from 'vitest';

import { combineRuns } from './measure';

import type { PhaseResult, TargetResult } from './measure';

const phase = (rps: number): PhaseResult => ({
  scenario: 'page',
  concurrency: 10,
  requests: rps * 10,
  rps,
  errors: 0,
  unexpected: {},
  bytesPerResponse: 5000,
  latencyMs: { mean: 1, p50: 1, p90: 1, p99: 1, max: 1 },
  cpuMsPerRequest: 1000 / rps,
  cpuCores: 0.25,
  memoryMb: { mean: 80, max: 90 }
});

const run = (rps: number, bootMs: number, overrides: Partial<TargetResult> = {}): TargetResult => ({
  target: 'render',
  status: 'ok',
  bootMs,
  idleMb: 60,
  phases: [phase(rps)],
  oomKilled: false,
  ...overrides
});

describe('combineRuns', () => {
  it('keeps each phase from its median run, and the median of each whole-run figure', () => {
    const combined = combineRuns([run(59, 1800), run(114, 1600), run(90, 1700)]);

    expect(combined.phases[0].rps).toBe(90);
    expect(combined.bootMs).toBe(1700);
  });

  it('reports a failure rather than hiding it behind the runs that worked', () => {
    const failed = run(0, 0, { status: 'failed', failure: 'OOM', phases: [] });

    expect(combineRuns([run(90, 1700), failed, run(100, 1600)])).toBe(failed);
  });
});
