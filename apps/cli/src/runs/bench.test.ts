import { describe, expect, it } from 'vitest';

import { benchText } from './bench';

import type { BenchLine } from './bench';

const line = (runId: string, overrides: Partial<BenchLine> = {}): BenchLine => ({
  runId,
  at: '2026-10-22T00:00:00.000Z',
  cli: '0.38.24',
  tasks: 7,
  done: 7,
  workMinutes: 50,
  minutesPerTask: 7.1,
  roundsPerTask: 2,
  checksFailedPct: 44,
  refusals: 6,
  identityRefusals: 0,
  uiWaitMedian: 3.6,
  reworkWaitMedian: 6,
  agentsWaited: 31,
  handOffs: 0,
  readTokens: 182_000,
  repeated: 2,
  ...overrides
});

// Carlos: "dicho reporte también se podría usar de bench, para ir mejorando tiempos, reducir el % de errores".
describe('the bench of a project’s runs', () => {
  it('lists each run measured the same way, a row each, oldest first', () => {
    const text = benchText([
      line('velada-polish'),
      line('velada-next', { roundsPerTask: 1.2, checksFailedPct: 20, handOffs: 1 })
    ]);

    expect(text[0]).toContain('| Run | Done | Worked (min) | Min / task | Rounds / task | Checks failed |');
    expect(text[2]).toBe('| velada-polish | 7/7 | 50 | 7.1 | 2 | 44% | 6 (0) | 3.6 | — | 6 | 31 | 0 | 182k | — | 2 |');
    expect(text[3]).toContain('| velada-next | 7/7 | 50 | 7.1 | 1.2 | 20% |');
  });

  it('says there is nothing to compare yet, rather than an empty table', () => {
    expect(benchText([])).toEqual([
      'No run of this project was measured yet: each report keeps its run’s measures beside it.'
    ]);
  });
});
