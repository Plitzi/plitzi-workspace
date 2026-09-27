export type LatencySummary = {
  mean: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
};

/** Nearest-rank percentile over values already sorted ascending. An empty set has no latency, reported as 0. */
export const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) {
    return 0;
  }

  const rank = Math.ceil((p / 100) * sorted.length);

  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
};

export const summarizeLatencies = (latencies: readonly number[]): LatencySummary => {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    mean: sorted.length === 0 ? 0 : total / sorted.length,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    max: sorted.length === 0 ? 0 : sorted[sorted.length - 1]
  };
};

export const round = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
};
