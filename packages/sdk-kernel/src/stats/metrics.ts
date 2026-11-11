import type { ProcessStats, StatsGauge, StatsWindow } from './types';

/** Prometheus's text format, the version every scraper reads. */
export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const WINDOWS = ['1m', '15m', '60m'] as const;
const HEALTH = ['healthy', 'degraded', 'stopping'] as const;

const escapeLabel = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

const escapeHelp = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');

const valueText = (value: number): string =>
  Number.isNaN(value) ? 'NaN' : value === Infinity ? '+Inf' : value === -Infinity ? '-Inf' : String(value);

/**
 * A figure's name and labels as Prometheus takes them, or why not: a name a scraper refuses would drop the whole
 * answer, so one is refused here by its name instead.
 */
const gaugeProblem = (gauge: StatsGauge): string | undefined => {
  if (!METRIC_NAME.test(gauge.name)) {
    return `"${gauge.name}" is no metric name: letters, digits, _ and :, not starting with a digit`;
  }

  const label = Object.keys(gauge.labels ?? {}).find(name => !LABEL_NAME.test(name) || name.startsWith('__'));

  return label === undefined ? undefined : `"${gauge.name}" has the label "${label}", which is no label name`;
};

/**
 * Gauges in Prometheus's text format: a `# HELP` and a `# TYPE` line once per name, the first help given winning, then
 * one line a sample. Throws naming the first figure a scraper would refuse.
 */
export const gaugesText = (gauges: StatsGauge[]): string => {
  const byName = new Map<string, { help: string; lines: string[] }>();
  for (const gauge of gauges) {
    const problem = gaugeProblem(gauge);
    if (problem) {
      throw new Error(problem);
    }

    const labels = Object.entries(gauge.labels ?? {});
    const labelText =
      labels.length === 0 ? '' : `{${labels.map(([name, value]) => `${name}="${escapeLabel(value)}"`).join(',')}}`;
    const entry = byName.get(gauge.name) ?? { help: gauge.help, lines: [] };
    entry.lines.push(`${gauge.name}${labelText} ${valueText(gauge.value)}`);
    byName.set(gauge.name, entry);
  }

  return [...byName]
    .map(([name, { help, lines }]) =>
      [`# HELP ${name} ${escapeHelp(help)}`, `# TYPE ${name} gauge`, ...lines].join('\n')
    )
    .join('\n')
    .concat(byName.size > 0 ? '\n' : '');
};

const windowGauges = (
  window: (typeof WINDOWS)[number],
  outcome: StatsWindow,
  labels: Record<string, string>
): StatsGauge[] => {
  const at = { ...labels, window };

  return [
    {
      name: 'plitzi_process_runs',
      help: 'Runs that ended in the window, failed ones included',
      value: outcome.runs,
      labels: at
    },
    ...Object.entries(outcome.failures).map(([reason, value]) => ({
      name: 'plitzi_process_run_failures',
      help: 'Runs that failed in the window — faults — by why',
      value,
      labels: { ...at, reason }
    })),
    ...Object.entries(outcome.limits).map(([limit, value]) => ({
      name: 'plitzi_process_run_limits',
      help: 'Runs stopped in the window at a limit of what they may spend, by which: not faults',
      value,
      labels: { ...at, limit }
    })),
    ...Object.entries(outcome.refusals).map(([reason, value]) => ({
      name: 'plitzi_process_refusals',
      help: 'Requests refused in the window before they became runs, by why',
      value,
      labels: { ...at, reason }
    })),
    ...(outcome.p95Ms === undefined
      ? []
      : [
          {
            name: 'plitzi_process_run_p95_seconds',
            help: "The window's 95th percentile of how long a run took",
            value: outcome.p95Ms / 1000,
            labels: at
          }
        ])
  ];
};

/**
 * What `/_stats` says of a process, as gauges: who it is, its load now, its work over the last minute, quarter and hour
 * (the `window` label) and its health. Labelled by its pool and its `process` — not `instance`, which a scraper keeps
 * for the address it scraped.
 */
export const processGauges = (stats: ProcessStats): StatsGauge[] => {
  const labels = { pool: stats.pool, process: stats.instance };

  return [
    {
      name: 'plitzi_process_info',
      help: 'A process of the platform: its pool, its name, the release it runs and the functions protocol it speaks',
      value: 1,
      labels: {
        ...labels,
        ...(stats.version === undefined ? {} : { version: stats.version }),
        ...(stats.protocol === undefined ? {} : { protocol: stats.protocol })
      }
    },
    { name: 'plitzi_process_uptime_seconds', help: 'How long the process has run', value: stats.uptimeSeconds, labels },
    ...Object.entries(stats.load.slots).flatMap(([slot, { used, of }]) => [
      { name: 'plitzi_process_slots_used', help: 'Work in flight in a slot', value: used, labels: { ...labels, slot } },
      { name: 'plitzi_process_slots_size', help: 'What a slot takes at once', value: of, labels: { ...labels, slot } }
    ]),
    {
      name: 'plitzi_process_cpu_cores',
      help: 'CPU spent over the last sample, in cores',
      value: stats.load.cpu,
      labels
    },
    {
      name: 'plitzi_process_resident_memory_bytes',
      help: "The process's resident memory",
      value: stats.load.memory.rss,
      labels
    },
    {
      name: 'plitzi_process_heap_used_bytes',
      help: "The JavaScript heap's used part",
      value: stats.load.memory.heapUsed,
      labels
    },
    {
      name: 'plitzi_process_event_loop_lag_p99_seconds',
      help: "The event loop's 99th percentile delay over the last sample",
      value: stats.load.eventLoopLagP99Ms / 1000,
      labels
    },
    ...WINDOWS.flatMap(window => windowGauges(window, stats.outcomes[window], labels)),
    ...HEALTH.map(status => ({
      name: 'plitzi_process_health',
      help: 'Whether the process says it is healthy, degraded or stopping: 1 for the one it says',
      value: stats.health.status === status ? 1 : 0,
      labels: { ...labels, status }
    }))
  ];
};

/** A process's metrics: its own figures, and after them those its deployment adds (`StatsConfig.gauges`). */
export const metricsText = (stats: ProcessStats, extra: StatsGauge[] = []): string =>
  gaugesText([...processGauges(stats), ...extra]);
