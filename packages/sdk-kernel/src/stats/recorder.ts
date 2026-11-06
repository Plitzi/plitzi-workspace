import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';

import { MINUTE_NAMES, MINUTE_RUNS } from './types';

import type {
  NamedWork,
  ProcessStats,
  RunEnd,
  RunLabel,
  SlowRun,
  StatsConfig,
  StatsMinute,
  StatsThresholds,
  StatsWindow
} from './types';

const MINUTE = 60_000;
const KEPT_MINUTES = 60;
/** How often the process's load is sampled on its own: what a minute's CPU, memory and lag are read from. */
const SAMPLE_EVERY_MS = 10_000;
/** Durations kept per minute for the percentiles: a uniform sample past this, so a busy minute costs no more. */
const SAMPLE = 512;
const DEFAULT_THRESHOLDS: Required<StatsThresholds> = { errorRate: 0.2, eventLoopLagMs: 500, slotShare: 0.9 };
/** Fewer runs than this say nothing about an error rate: one failure in three is a bad minute, not a sick process. */
const RATE_FLOOR = 10;

type Load = { cpu: number; rss: number; lagMs: number };

type Bucket = {
  minute: number;
  runs: number;
  seen: number;
  durations: number[];
  failures: Map<string, number>;
  limits: Map<string, number>;
  refusals: Map<string, number>;
  /** The load's samples taken in this minute: their mean CPU, and the most memory and lag any of them saw. */
  load?: { cpuSum: number; samples: number; rss: number; lagMs: number };
  /** The slowest labelled runs and every labelled one that did not answer, kept short; and each name's work, up to {@link NAMES}. */
  slow: SlowRun[];
  names: Map<string, NamedWork>;
};

/** How many names a minute counts on their own; past it, a new name's runs are not kept by name. */
const NAMES = 200;

export type StatsRecorder = {
  /**
   * A run ended: how long it took, how when it did not simply answer ({@link RunEnd}: failed, at a limit, refused by its
   * code), and — when the recorder knows — what it was.
   */
  run: (durationMs: number, end?: RunEnd, label?: RunLabel) => void;
  /** A request refused before it became a run. */
  refuse: (reason: string) => void;
  /**
   * Work in flight against a size: read when the stats are, so nothing is counted twice. With `queues`, what comes past
   * the size waits its turn rather than being refused — a worker's jobs, a runner's invocations — and a full slot is a
   * process at work: it degrades only while something waits (`used` past `of`). Otherwise near full degrades it: what
   * comes next is refused.
   */
  slot: (name: string, of: number, used: () => number, options?: { queues?: boolean }) => void;
  snapshot: () => ProcessStats;
};

const add = (map: Map<string, number>, key: string): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const percentile = (sorted: number[], share: number): number | undefined =>
  sorted.length === 0 ? undefined : sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];

const total = (map: Map<string, number>): number => [...map.values()].reduce((sum, count) => sum + count, 0);

/** Every minute of the last hour, oldest first — one with nothing in it said as zero runs, so a chart's axis is time. */
const seriesOf = (buckets: Bucket[], minute: number): StatsMinute[] => {
  const byMinute = new Map(buckets.map(bucket => [bucket.minute, bucket]));

  return Array.from({ length: KEPT_MINUTES }, (_, index): StatsMinute => {
    const at = minute - KEPT_MINUTES + 1 + index;
    const bucket = byMinute.get(at);
    const p95Ms = bucket
      ? percentile(
          [...bucket.durations].sort((a, b) => a - b),
          0.95
        )
      : undefined;
    const load = bucket?.load;

    return {
      at: new Date(at * MINUTE).toISOString(),
      runs: bucket?.runs ?? 0,
      failed: bucket ? total(bucket.failures) : 0,
      limited: bucket ? total(bucket.limits) : 0,
      refused: bucket ? total(bucket.refusals) : 0,
      ...(p95Ms === undefined ? {} : { p95Ms }),
      ...(load
        ? { cpu: Math.round((load.cpuSum / load.samples) * 1000) / 1000, rss: load.rss, lagMs: load.lagMs }
        : {}),
      ...(bucket && bucket.slow.length > 0 ? { runsOf: bucket.slow } : {}),
      ...(bucket && bucket.names.size > 0
        ? { names: [...bucket.names.values()].sort((a, b) => b.totalMs - a.totalMs).slice(0, MINUTE_NAMES) }
        : {})
    };
  });
};

/** Whether a kept run is one to look at: it failed, or it reached a limit. */
const unanswered = (run: SlowRun): number => Number(run.failure !== undefined || run.limit !== undefined);

/**
 * Keeps a labelled run among its minute's: every failure and every limit reached first, then the slowest,
 * {@link MINUTE_RUNS} in all — what a spike on a chart is traced back to.
 */
const keepRun = (bucket: Bucket, run: SlowRun): void => {
  bucket.slow.push(run);
  bucket.slow.sort((a, b) => unanswered(b) - unanswered(a) || b.durationMs - a.durationMs);
  bucket.slow.length = Math.min(bucket.slow.length, MINUTE_RUNS);
};

const keepName = (bucket: Bucket, label: RunLabel, durationMs: number, end: RunEnd | undefined): void => {
  const key = `${String(label.spaceId)}:${label.kind}:${label.name}`;
  const kept = bucket.names.get(key);
  if (!kept && bucket.names.size >= NAMES) {
    return;
  }

  const work = kept ?? {
    spaceId: label.spaceId,
    kind: label.kind,
    name: label.name,
    runs: 0,
    failed: 0,
    limited: 0,
    totalMs: 0,
    maxMs: 0
  };
  work.runs += 1;
  work.failed += end && 'failed' in end ? 1 : 0;
  work.limited += end && 'limit' in end ? 1 : 0;
  work.totalMs += durationMs;
  work.maxMs = Math.max(work.maxMs, durationMs);
  bucket.names.set(key, work);
};

const windowOf = (buckets: Bucket[]): StatsWindow => {
  const failures: Record<string, number> = {};
  const limits: Record<string, number> = {};
  const refusals: Record<string, number> = {};
  const durations: number[] = [];
  let runs = 0;
  for (const bucket of buckets) {
    runs += bucket.runs;
    bucket.failures.forEach((count, reason) => (failures[reason] = (failures[reason] ?? 0) + count));
    bucket.limits.forEach((count, limit) => (limits[limit] = (limits[limit] ?? 0) + count));
    bucket.refusals.forEach((count, reason) => (refusals[reason] = (refusals[reason] ?? 0) + count));
    durations.push(...bucket.durations);
  }

  durations.sort((a, b) => a - b);
  const p50Ms = percentile(durations, 0.5);
  const p95Ms = percentile(durations, 0.95);

  return {
    runs,
    failures,
    limits,
    refusals,
    ...(p50Ms === undefined ? {} : { p50Ms }),
    ...(p95Ms === undefined ? {} : { p95Ms })
  };
};

/**
 * A process's stats, kept in memory in one-minute buckets for an hour: what it records costs a map update, and a read
 * is the only work. Its load — CPU, memory, the event loop's delay — is sampled every ten seconds on its own, so each
 * minute keeps its own, and two readers never split one measurement between them.
 */
export const createStatsRecorder = (
  identity: Pick<StatsConfig, 'pool' | 'instance' | 'thresholds'> & { version?: string; protocol?: string },
  now: () => number = Date.now
): StatsRecorder => {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...identity.thresholds };
  const instance = identity.instance ?? `${os.hostname()}:${String(process.pid)}`;
  const buckets: Bucket[] = [];
  const slots = new Map<string, { of: number; used: () => number; queues: boolean }>();
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let cpuAt = { usage: process.cpuUsage(), wall: process.hrtime.bigint() };

  const current = (): Bucket => {
    const minute = Math.floor(now() / MINUTE);
    const last = buckets.at(-1);
    if (last?.minute === minute) {
      return last;
    }

    const bucket: Bucket = {
      minute,
      runs: 0,
      seen: 0,
      durations: [],
      failures: new Map(),
      limits: new Map(),
      refusals: new Map(),
      slow: [],
      names: new Map()
    };
    buckets.push(bucket);
    while (buckets.length > 0 && (buckets[0]?.minute ?? minute) <= minute - KEPT_MINUTES) {
      buckets.shift();
    }

    return bucket;
  };
  const since = (minutes: number): Bucket[] => {
    const from = Math.floor(now() / MINUTE) - minutes;

    return buckets.filter(bucket => bucket.minute > from);
  };

  const readCpu = (): number => {
    const usage = process.cpuUsage(cpuAt.usage);
    const wall = process.hrtime.bigint();
    const elapsedUs = Number(wall - cpuAt.wall) / 1000;
    cpuAt = { usage: process.cpuUsage(), wall };

    return elapsedUs > 0 ? Math.round(((usage.user + usage.system) / elapsedUs) * 1000) / 1000 : 0;
  };

  let latest: Load | undefined;
  const sample = (): Load => {
    const reading: Load = {
      cpu: readCpu(),
      rss: process.memoryUsage.rss(),
      lagMs: Math.round(lag.percentile(99) / 1e4) / 100
    };
    lag.reset();
    const bucket = current();
    const kept = bucket.load ?? { cpuSum: 0, samples: 0, rss: 0, lagMs: 0 };
    bucket.load = {
      cpuSum: kept.cpuSum + reading.cpu,
      samples: kept.samples + 1,
      rss: Math.max(kept.rss, reading.rss),
      lagMs: Math.max(kept.lagMs, reading.lagMs)
    };
    latest = reading;

    return reading;
  };
  const sampler = setInterval(sample, SAMPLE_EVERY_MS);
  sampler.unref();

  return {
    run: (durationMs, end, label) => {
      const bucket = current();
      if (label) {
        keepRun(bucket, {
          ...label,
          at: new Date(now()).toISOString(),
          durationMs: Math.round(durationMs),
          ...(end && 'failed' in end ? { failure: end.failed } : {}),
          ...(end && 'limit' in end ? { limit: end.limit } : {}),
          ...(end && 'refused' in end ? { refused: true as const } : {})
        });
        keepName(bucket, label, durationMs, end);
      }

      bucket.runs += 1;
      bucket.seen += 1;
      if (bucket.durations.length < SAMPLE) {
        bucket.durations.push(durationMs);
      } else {
        const at = Math.floor(Math.random() * bucket.seen);
        if (at < SAMPLE) {
          bucket.durations[at] = durationMs;
        }
      }

      if (end && 'failed' in end) {
        add(bucket.failures, end.failed);
      }

      if (end && 'limit' in end) {
        add(bucket.limits, end.limit);
      }
    },
    refuse: reason => {
      add(current().refusals, reason);
    },
    slot: (name, of, used, { queues = false } = {}) => {
      slots.set(name, { of, used, queues });
    },
    snapshot: () => {
      const outcomes = { '1m': windowOf(since(1)), '15m': windowOf(since(15)), '60m': windowOf(since(60)) };
      const memory = process.memoryUsage();
      // The last sample, or one taken now when none is yet: the first ten seconds of a process.
      const { cpu, lagMs: eventLoopLagP99Ms } = latest ?? sample();
      const load = {
        slots: Object.fromEntries([...slots].map(([name, slot]) => [name, { used: slot.used(), of: slot.of }])),
        cpu,
        memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal },
        eventLoopLagP99Ms
      };

      const reasons: string[] = [];
      const quarter = outcomes['15m'];
      const failed = Object.values(quarter.failures).reduce((sum, count) => sum + count, 0);
      if (quarter.runs >= RATE_FLOOR && failed / quarter.runs > thresholds.errorRate) {
        reasons.push(`${String(failed)} of ${String(quarter.runs)} runs failed in 15 minutes`);
      }

      if (eventLoopLagP99Ms > thresholds.eventLoopLagMs) {
        reasons.push(`the event loop is ${String(eventLoopLagP99Ms)} ms behind (p99)`);
      }

      Object.entries(load.slots).forEach(([name, slot]) => {
        const waits = slots.get(name)?.queues === true;
        if (waits ? slot.used > slot.of : slot.of > 0 && slot.used / slot.of > thresholds.slotShare) {
          reasons.push(
            waits
              ? `${name}: ${String(slot.used - slot.of)} waiting past its ${String(slot.of)}`
              : `${name}: ${String(slot.used)} of ${String(slot.of)} in use`
          );
        }
      });

      return {
        pool: identity.pool,
        instance,
        ...(identity.version ? { version: identity.version } : {}),
        ...(identity.protocol ? { protocol: identity.protocol } : {}),
        at: new Date(now()).toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        load,
        outcomes,
        series: seriesOf(buckets, Math.floor(now() / MINUTE)),
        health: { status: reasons.length > 0 ? 'degraded' : 'healthy', reasons }
      };
    }
  };
};

const recorders = new WeakMap<StatsConfig, StatsRecorder>();

/**
 * The one recorder of a process's stats configuration: what feeds it (the engine's runs, a runner's isolates) and what
 * answers `/_stats` reach it from the same configuration, without handing it around.
 */
export const statsRecorderFor = (config: StatsConfig, version?: string): StatsRecorder => {
  const existing = recorders.get(config);
  if (existing) {
    return existing;
  }

  const recorder = createStatsRecorder({ ...config, ...(version ? { version } : {}) });
  recorders.set(config, recorder);

  return recorder;
};
