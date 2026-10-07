import type { RunMetrics } from './metrics';

/**
 * Many runs read as RFC 0025 §5.4 reads them: per configuration (a model and a context level), the three kinds of
 * degradation and the cost per verified success, held to the largest model's; and the floor — the smallest
 * configuration that is as good, and among those the cheapest.
 */

export interface RunResult {
  /** `claude:claude-haiku-4-5-20251001`, `opencode:ollama/qwen3.6:latest` — the ladder's rungs, largest first. */
  model: string;
  context: string;
  task: string;
  run: number;
  check: { ok: boolean; why?: string };
  metrics: RunMetrics;
}

/** RFC 0025 §5.4's proposals; the first baseline's spread says whether they sit outside the noise. */
export const TOLERANCES = {
  successBelow: 0.05,
  hallucinationAbove: 0.01,
  wasteAverage: 0.15,
  wastePerTask: 0.3,
  ceilingTimesMedian: 3
};

export interface ConfigurationReport {
  configuration: string;
  runs: number;
  successRate: number;
  /** Runs that met at least one refusal naming something made up. */
  hallucinationRate: number;
  wasteAverage: number;
  wasteWorstTask: number;
  /** Net tokens of every run, divided by the runs whose result was verified. */
  costPerSuccess: number;
  /** Tasks it never did, in any run. */
  neverDone: string[];
  belowFloorBecause: string[];
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const configurationOf = (result: RunResult): string => `${result.model} @ ${result.context}`;

/** Each run held to its task's ceiling: three times the reference configuration's median on that task. */
const withCeilings = (results: readonly RunResult[], reference: string): RunResult[] => {
  const ceilings = new Map<string, number>();
  for (const task of new Set(results.map(result => result.task))) {
    const done = results.filter(
      result => configurationOf(result) === reference && result.task === task && result.check.ok
    );
    if (done.length > 0) {
      ceilings.set(task, TOLERANCES.ceilingTimesMedian * median(done.map(result => result.metrics.netTokens)));
    }
  }

  return results.map(result => {
    const ceiling = ceilings.get(result.task);
    if (ceiling === undefined || result.metrics.netTokens <= ceiling || !result.metrics.success) {
      return result;
    }

    return {
      ...result,
      metrics: {
        ...result.metrics,
        success: false,
        ceilingHit: true,
        failedBecause: `over the ceiling of ${String(Math.round(ceiling))} tokens`
      }
    };
  });
};

export const reportOf = (all: readonly RunResult[]): { configurations: ConfigurationReport[]; floor?: string } => {
  const order = [...new Set(all.map(configurationOf))];
  const reference = order[0];
  if (!reference) {
    return { configurations: [] };
  }

  const results = withCeilings(all, reference);
  const tasks = [...new Set(results.map(result => result.task))];
  const summarize = (configuration: string): Omit<ConfigurationReport, 'belowFloorBecause'> => {
    const runs = results.filter(result => configurationOf(result) === configuration);
    const successes = runs.filter(result => result.metrics.success);
    const wastePerTask = tasks.map(task =>
      average(runs.filter(result => result.task === task).map(result => result.metrics.wasteShare))
    );

    return {
      configuration,
      runs: runs.length,
      successRate: successes.length / Math.max(1, runs.length),
      hallucinationRate: runs.filter(result => result.metrics.hallucinations > 0).length / Math.max(1, runs.length),
      wasteAverage: average(runs.map(result => result.metrics.wasteShare)),
      wasteWorstTask: Math.max(0, ...wastePerTask),
      costPerSuccess:
        successes.length === 0
          ? Number.POSITIVE_INFINITY
          : runs.reduce((total, result) => total + result.metrics.netTokens, 0) / successes.length,
      neverDone: tasks.filter(task => !successes.some(result => result.task === task))
    };
  };

  const base = summarize(reference);
  const configurations = order.map((configuration): ConfigurationReport => {
    const summary = summarize(configuration);
    const below = [
      ...(summary.successRate < base.successRate - TOLERANCES.successBelow ? ['succeeds less'] : []),
      ...(summary.hallucinationRate > base.hallucinationRate + TOLERANCES.hallucinationAbove
        ? ['hallucinates more']
        : []),
      ...(summary.wasteAverage > TOLERANCES.wasteAverage ? ['wastes too much on average'] : []),
      ...(summary.wasteWorstTask > TOLERANCES.wastePerTask ? ['wastes too much on a task'] : []),
      ...(summary.neverDone.length > 0 ? [`never did ${summary.neverDone.join(', ')}`] : [])
    ];

    return { ...summary, belowFloorBecause: below };
  });

  // Among those at or above the floor, the cheapest per verified success is the one to recommend.
  const passing = configurations.filter(configuration => configuration.belowFloorBecause.length === 0);
  const floor = passing.reduce<ConfigurationReport | undefined>(
    (best, configuration) => (!best || configuration.costPerSuccess < best.costPerSuccess ? configuration : best),
    undefined
  );

  return { configurations, ...(floor ? { floor: floor.configuration } : {}) };
};

const percent = (value: number): string => `${(value * 100).toFixed(0)}%`;

export const reportMarkdown = (all: readonly RunResult[]): string => {
  const { configurations, floor } = reportOf(all);
  const rows = configurations.map(
    entry =>
      `| ${entry.configuration} | ${String(entry.runs)} | ${percent(entry.successRate)} | ${percent(entry.hallucinationRate)} | ${percent(entry.wasteAverage)} (worst ${percent(entry.wasteWorstTask)}) | ${Number.isFinite(entry.costPerSuccess) ? Math.round(entry.costPerSuccess).toLocaleString('en') : '—'} | ${entry.belowFloorBecause.join('; ') || 'at or above the floor'} |`
  );

  return [
    '# Agents on Plitzi — the floor',
    '',
    `The first configuration is the reference; tolerances: success within ${percent(TOLERANCES.successBelow)}, hallucination within ${percent(TOLERANCES.hallucinationAbove)}, waste ≤ ${percent(TOLERANCES.wasteAverage)} on average and ${percent(TOLERANCES.wastePerTask)} on a task, every task done at least once; a run over ${String(TOLERANCES.ceilingTimesMedian)}× the reference's median on its task fails.`,
    '',
    '| Configuration | Runs | Success | Hallucinated | Waste | Net tokens per success | Floor |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    floor
      ? `**Recommended: ${floor}** — at or above the floor, and the cheapest per verified success.`
      : 'No configuration is at or above the floor.'
  ].join('\n');
};
