import { describe, expect, it } from 'vitest';

import { percentile, summarizeLatencies } from './stats';

describe('percentile', () => {
  it('takes the nearest rank', () => {
    const sorted = Array.from({ length: 100 }, (_, index) => index + 1);

    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 100)).toBe(100);
  });

  it('reports no latency for no requests rather than NaN', () => {
    expect(summarizeLatencies([])).toEqual({ mean: 0, p50: 0, p90: 0, p99: 0, max: 0 });
  });

  it('sorts what it is given without reordering the caller’s array', () => {
    const latencies = [30, 10, 20];
    const summary = summarizeLatencies(latencies);

    expect(summary).toMatchObject({ p50: 20, max: 30, mean: 20 });
    expect(latencies).toEqual([30, 10, 20]);
  });
});
