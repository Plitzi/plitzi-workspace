import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';

/**
 * How loaded this process is right now — the CPU it used over the last couple of seconds against what it may use, and
 * how far its event loop is behind — read by whatever decides whether it takes more work: a worker before it claims
 * jobs, a runner before it takes an invocation. Its size is the most it may use, not what it runs: what it takes is
 * what it still has room for. One histogram and one CPU reading a process, however many ask.
 */
export type ProcessLoad = {
  /** The CPU it used over the last window, in cores. */
  cpuCores: number;
  /** Of what it may use (`cpuLimitCores`): 1 is all of it. */
  cpuShare: number;
  /** The event loop's p99 delay, in ms: what a container short of CPU shows first, its quota spent. */
  lagMs: number;
};

/** Where a process stops taking new work. Below the 500 ms its stats call `degraded`. */
export const LOAD_LIMITS = { cpuShare: 0.9, lagMs: 250 } as const;

const WINDOW_MS = 2000;

/** The quota of a cgroup's `cpu.max` (v2) or `cpu.cfs_quota_us`/`cpu.cfs_period_us` (v1), in cores. */
const cgroupCores = (): number | undefined => {
  const read = (file: string): string | undefined => {
    try {
      return readFileSync(file, 'utf8').trim();
    } catch {
      return undefined;
    }
  };

  // `max 100000` when it has no quota: `max` reads as NaN, which is no quota.
  const [quota, period] = (read('/sys/fs/cgroup/cpu.max') ?? '').split(' ');
  if (Number(quota) > 0 && Number(period) > 0) {
    return Number(quota) / Number(period);
  }

  const v1Quota = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'));
  const v1Period = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));

  return v1Quota > 0 && v1Period > 0 ? v1Quota / v1Period : undefined;
};

let limitCores: number | undefined;

/**
 * The CPU this process may use, in cores: its container's quota, or the machine's cores where it has none. Read once —
 * a container's quota does not move while it lives.
 */
export const cpuLimitCores = (): number => {
  limitCores ??= cgroupCores() ?? availableParallelism();

  return limitCores;
};

let histogram: ReturnType<typeof monitorEventLoopDelay> | undefined;
let windowAt = 0;
let cpuAt = process.cpuUsage();
let last: ProcessLoad = { cpuCores: 0, cpuShare: 0, lagMs: 0 };

/**
 * The load over the last whole window (2 s), and the loop's delay over the window under way when it is worse: a spike is
 * acted on at once and not forgotten until a window has passed without it. Measured from the first time it is asked.
 */
export const processLoad = (): ProcessLoad => {
  const now = Date.now();
  if (!histogram) {
    histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
    windowAt = now;
    cpuAt = process.cpuUsage();
  }

  const lagMs = histogram.percentile(99) / 1e6;
  const elapsedMs = now - windowAt;
  if (elapsedMs >= WINDOW_MS) {
    const used = process.cpuUsage(cpuAt);
    const cpuCores = (used.user + used.system) / 1000 / elapsedMs;
    last = { cpuCores, cpuShare: cpuCores / cpuLimitCores(), lagMs };
    histogram.reset();
    windowAt = now;
    cpuAt = process.cpuUsage();

    return last;
  }

  return { ...last, lagMs: Math.max(last.lagMs, lagMs) };
};

/** Why a process this loaded takes no new work, in words — or nothing, when it has room. */
export const overloaded = (load: ProcessLoad): string | undefined => {
  if (load.cpuShare >= LOAD_LIMITS.cpuShare) {
    return `its CPU is ${String(Math.round(load.cpuShare * 100))}% used (${load.cpuCores.toFixed(2)} of ${String(cpuLimitCores())} cores)`;
  }

  return load.lagMs >= LOAD_LIMITS.lagMs
    ? `its event loop is ${String(Math.round(load.lagMs))} ms behind (p99)`
    : undefined;
};
