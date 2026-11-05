import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';

import type { ProcessStats, StatsConfig, StatsThresholds, StatsWindow } from './types';

const MINUTE = 60_000;
const KEPT_MINUTES = 60;
/** Durations kept per minute for the percentiles: a uniform sample past this, so a busy minute costs no more. */
const SAMPLE = 512;
const DEFAULT_THRESHOLDS: Required<StatsThresholds> = { errorRate: 0.2, eventLoopLagMs: 500, slotShare: 0.9 };
/** Fewer runs than this say nothing about an error rate: one failure in three is a bad minute, not a sick process. */
const RATE_FLOOR = 10;

type Bucket = {
  minute: number;
  runs: number;
  seen: number;
  durations: number[];
  failures: Map<string, number>;
  refusals: Map<string, number>;
};

export type StatsRecorder = {
  /** A run ended: how long it took, and why it failed when it did. */
  run: (durationMs: number, failure?: string) => void;
  /** A request refused before it became a run. */
  refuse: (reason: string) => void;
  /** Work in flight against a size: read when the stats are, so nothing is counted twice. */
  slot: (name: string, of: number, used: () => number) => void;
  snapshot: () => ProcessStats;
};

const add = (map: Map<string, number>, key: string): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const percentile = (sorted: number[], share: number): number | undefined =>
  sorted.length === 0 ? undefined : sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];

const windowOf = (buckets: Bucket[]): StatsWindow => {
  const failures: Record<string, number> = {};
  const refusals: Record<string, number> = {};
  const durations: number[] = [];
  let runs = 0;
  for (const bucket of buckets) {
    runs += bucket.runs;
    bucket.failures.forEach((count, reason) => (failures[reason] = (failures[reason] ?? 0) + count));
    bucket.refusals.forEach((count, reason) => (refusals[reason] = (refusals[reason] ?? 0) + count));
    durations.push(...bucket.durations);
  }

  durations.sort((a, b) => a - b);
  const p50Ms = percentile(durations, 0.5);
  const p95Ms = percentile(durations, 0.95);

  return {
    runs,
    failures,
    refusals,
    ...(p50Ms === undefined ? {} : { p50Ms }),
    ...(p95Ms === undefined ? {} : { p95Ms })
  };
};

/**
 * A process's stats, kept in memory in one-minute buckets for an hour: what it records costs a map update, and a read
 * is the only work. CPU is measured between two reads, the event loop's delay since the last one.
 */
export const createStatsRecorder = (
  identity: Pick<StatsConfig, 'pool' | 'instance' | 'thresholds'> & { version?: string; protocol?: string },
  now: () => number = Date.now
): StatsRecorder => {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...identity.thresholds };
  const instance = identity.instance ?? `${os.hostname()}:${String(process.pid)}`;
  const buckets: Bucket[] = [];
  const slots = new Map<string, { of: number; used: () => number }>();
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let cpuAt = { usage: process.cpuUsage(), wall: process.hrtime.bigint() };

  const current = (): Bucket => {
    const minute = Math.floor(now() / MINUTE);
    const last = buckets.at(-1);
    if (last?.minute === minute) {
      return last;
    }

    const bucket: Bucket = { minute, runs: 0, seen: 0, durations: [], failures: new Map(), refusals: new Map() };
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

  return {
    run: (durationMs, failure) => {
      const bucket = current();
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

      if (failure) {
        add(bucket.failures, failure);
      }
    },
    refuse: reason => {
      add(current().refusals, reason);
    },
    slot: (name, of, used) => {
      slots.set(name, { of, used });
    },
    snapshot: () => {
      const outcomes = { '1m': windowOf(since(1)), '15m': windowOf(since(15)), '60m': windowOf(since(60)) };
      const memory = process.memoryUsage();
      const eventLoopLagP99Ms = Math.round(lag.percentile(99) / 1e4) / 100;
      lag.reset();
      const load = {
        slots: Object.fromEntries([...slots].map(([name, slot]) => [name, { used: slot.used(), of: slot.of }])),
        cpu: readCpu(),
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
        if (slot.of > 0 && slot.used / slot.of > thresholds.slotShare) {
          reasons.push(`${name}: ${String(slot.used)} of ${String(slot.of)} in use`);
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
