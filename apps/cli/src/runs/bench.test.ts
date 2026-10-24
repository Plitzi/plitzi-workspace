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
  readTokens: 182_000,
  repeated: 2,
  ...overrides
});

// Carlos: "dicho reporte también se podría usar de bench, para ir mejorando tiempos, reducir el % de errores".
describe('the bench of a project’s runs', () => {
  it('lists each run measured the same way, a row each, oldest first', () => {
    const text = benchText([
      line('velada-polish'),
      line('velada-next', { roundsPerTask: 1.2, checksFailedPct: 20, checksNotOwn: 9 })
    ]);

    expect(text[0]).toContain(
      '| Run | Done | Worked (min) | Min / task | Rounds / task | Checks failed | Not theirs |'
    );
    // A run measured before checks said what was not the copy's has no count of them: "—", never 0.
    expect(text[2]).toBe(
      '| velada-polish | 7/7 | 50 | 7.1 | 2 | 44% | — | 6 (0) | 3.6 | — | 6 | 31 | 182k | — | — | 2 | — | — |'
    );
    expect(text[3]).toContain('| velada-next | 7/7 | 50 | 7.1 | 1.2 | 20% | 9 |');
  });

  // lx-product: dev-1's harness said 310k — its context at the end — and it read 30.9M again over 164 turns.
  it('says the harness’s count as a context a task, and what was read again as what a run spends', () => {
    const text = benchText([line('lx-product', { tokensPerTask: 113_000, rereadPerTask: 7_200_000 })]);

    expect(text[0]).toContain('| Context / task | Read again / task (≥) |');
    expect(text[2]).toContain('| 182k | 113k | 7.2M |');
  });

  it('says there is nothing to compare yet, rather than an empty table', () => {
    expect(benchText([])).toEqual([
      'No run of this project was measured yet: each report keeps its run’s measures beside it.'
    ]);
  });
});
