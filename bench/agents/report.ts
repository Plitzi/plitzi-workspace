import type { RunMetrics } from './metrics';

/**
 * Many runs read as the agent benchmark reads them (`bench/README.md` § Agents): per configuration (a model and a context level), the three kinds of
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

/**
 * The floor's tolerances. At 30 runs a configuration a rate's 95% interval is about eleven points wide — wider than
 * `successBelow` — so they decide only with the spread beside them (`bench/README.md` § The first baseline).
 */
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
  /** The spread across runs: a difference inside it is no difference. 95% Wilson intervals for the rates. */
  spread: { success: Interval; hallucination: Interval; netTokens: Interval };
  /** Each task as this configuration did it: what the next tool should take off the model, where it broke. */
  tasks: TaskReport[];
}

/** Low and high, inclusive. For a rate, its 95% Wilson interval; for tokens, the run's first and third quartiles. */
export type Interval = readonly [number, number];

export interface TaskReport {
  task: string;
  runs: number;
  successes: number;
  /** Why the runs that failed did, most common first. */
  failedBecause: { why: string; runs: number }[];
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }

  const at = (sorted.length - 1) * q;
  const below = Math.floor(at);
  const above = Math.min(sorted.length - 1, below + 1);

  return sorted[below] + (sorted[above] - sorted[below]) * (at - below);
};

// Wilson's interval rather than the normal one: with five runs a rate of 0% or 100% is common, and the normal interval
// would call it certain.
export const wilson = (hits: number, runs: number): Interval => {
  if (runs === 0) {
    return [0, 1];
  }

  const z = 1.96;
  const rate = hits / runs;
  const centre = rate + (z * z) / (2 * runs);
  const margin = z * Math.sqrt((rate * (1 - rate)) / runs + (z * z) / (4 * runs * runs));
  const denominator = 1 + (z * z) / runs;

  return [Math.max(0, (centre - margin) / denominator), Math.min(1, (centre + margin) / denominator)];
};

const tasksOf = (runs: readonly RunResult[], tasks: readonly string[]): TaskReport[] =>
  tasks.map(task => {
    const ofTask = runs.filter(result => result.task === task);
    const reasons = new Map<string, number>();
    for (const result of ofTask) {
      if (!result.metrics.success) {
        const why = result.metrics.failedBecause ?? result.check.why ?? 'the check failed';
        reasons.set(why, (reasons.get(why) ?? 0) + 1);
      }
    }

    return {
      task,
      runs: ofTask.length,
      successes: ofTask.filter(result => result.metrics.success).length,
      failedBecause: [...reasons].map(([why, count]) => ({ why, runs: count })).sort((a, b) => b.runs - a.runs)
    };
  });

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
    const hallucinated = runs.filter(result => result.metrics.hallucinations > 0).length;
    const tokens = runs.map(result => result.metrics.netTokens);

    return {
      configuration,
      runs: runs.length,
      successRate: successes.length / Math.max(1, runs.length),
      hallucinationRate: hallucinated / Math.max(1, runs.length),
      wasteAverage: average(runs.map(result => result.metrics.wasteShare)),
      wasteWorstTask: Math.max(0, ...wastePerTask),
      costPerSuccess:
        successes.length === 0
          ? Number.POSITIVE_INFINITY
          : runs.reduce((total, result) => total + result.metrics.netTokens, 0) / successes.length,
      neverDone: tasks.filter(task => !successes.some(result => result.task === task)),
      spread: {
        success: wilson(successes.length, runs.length),
        hallucination: wilson(hallucinated, runs.length),
        netTokens: [quantile(tokens, 0.25), quantile(tokens, 0.75)]
      },
      tasks: tasksOf(runs, tasks)
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

const range = ([low, high]: Interval): string => `${(low * 100).toFixed(0)}–${(high * 100).toFixed(0)}`;

const thousands = (value: number): string => Math.round(value).toLocaleString('en');

const brokeWhere = (entry: ConfigurationReport): string[] => {
  const broken = entry.tasks.filter(task => task.successes < task.runs);
  if (broken.length === 0) {
    return [];
  }

  return [
    '',
    `### ${entry.configuration}`,
    '',
    ...broken.map(
      task =>
        `- **${task.task}**: ${String(task.successes)}/${String(task.runs)} — ${task.failedBecause.map(reason => `${reason.why} (${String(reason.runs)})`).join('; ')}`
    )
  ];
};

export const reportMarkdown = (all: readonly RunResult[]): string => {
  const { configurations, floor } = reportOf(all);
  const rows = configurations.map(
    entry =>
      `| ${entry.configuration} | ${String(entry.runs)} | ${percent(entry.successRate)} (${range(entry.spread.success)}) | ${percent(entry.hallucinationRate)} (${range(entry.spread.hallucination)}) | ${percent(entry.wasteAverage)} (worst ${percent(entry.wasteWorstTask)}) | ${Number.isFinite(entry.costPerSuccess) ? thousands(entry.costPerSuccess) : '—'} | ${thousands(entry.spread.netTokens[0])}–${thousands(entry.spread.netTokens[1])} | ${entry.belowFloorBecause.join('; ') || 'at or above the floor'} |`
  );
  const broke = configurations.flatMap(brokeWhere);

  return [
    '# Agents on Plitzi — the floor',
    '',
    `The first configuration is the reference; tolerances: success within ${percent(TOLERANCES.successBelow)}, hallucination within ${percent(TOLERANCES.hallucinationAbove)}, waste ≤ ${percent(TOLERANCES.wasteAverage)} on average and ${percent(TOLERANCES.wastePerTask)} on a task, every task done at least once; a run over ${String(TOLERANCES.ceilingTimesMedian)}× the reference's median on its task fails. Beside each rate, its 95% interval across the runs; beside the cost, the runs' net tokens from the first to the third quartile — a difference inside them is no difference.`,
    '',
    '| Configuration | Runs | Success | Hallucinated | Waste | Net tokens per success | Net tokens a run | Floor |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    floor
      ? `**Recommended: ${floor}** — at or above the floor, and the cheapest per verified success.`
      : 'No configuration is at or above the floor.',
    ...(broke.length > 0 ? ['', '## Where each one broke', ...broke] : [])
  ].join('\n');
};
