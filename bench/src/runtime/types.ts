import type { ProbeSample } from '../../probe/protocol';
import type { Profile } from '../profiles';
import type { Runner, Target } from '../targets';

export type ResourceSample = {
  /** Memory charged to the server: the container's cgroup, or the resident set of the process tree outside one. */
  memoryBytes: number;
  /** Anonymous memory — heap, stacks, native buffers: what the kernel cannot drop. Known inside a container only. */
  anonBytes?: number;
  /** The highest `memoryBytes` since the server started. Known inside a container only. */
  peakBytes?: number;
  /** CPU time consumed since the server started, every thread and child included. */
  cpuUsec: number;
  /** Scheduler periods elapsed, and how many of them ended with the quota spent. Known under a CPU limit only. */
  periods?: number;
  throttledPeriods?: number;
};

export type ExitState = {
  running: boolean;
  oomKilled: boolean;
  exitCode?: number;
};

export type Sampler = {
  /** Stops sampling and hands back every sample taken. */
  stop: () => ResourceSample[];
};

export type RunningTarget = {
  baseUrl: string;
  sample: () => Promise<ResourceSample>;
  sampleEvery: (intervalMs: number) => Sampler;
  state: () => Promise<ExitState>;
  /** What the in-process probe reported since `sinceMs` (epoch). */
  probe: (sinceMs: number) => Promise<ProbeSample[]>;
  /** The server's own output, probe lines left out. */
  logs: () => Promise<string>;
  stop: () => Promise<void>;
};

export type LaunchOptions = {
  target: Target;
  profile: Profile;
  workspaceRoot: string;
  nodeOptions: string[];
  runner: Runner;
  /** Extra environment for the server, over the target's own — an allocator setting, a feature flag. */
  env: Record<string, string>;
};

/**
 * The command line that starts `entry` under `runner`, with the probe loaded first. The flags go on the command line
 * rather than in `NODE_OPTIONS`, which accepts only a fixed list of V8 flags.
 */
export const nodeArgs = (runner: Runner, entry: string, probe: string, flags: string[]): string[] => [
  ...flags,
  '--import',
  probe,
  ...(runner === 'tsx' ? ['--import', 'tsx'] : []),
  entry
];

export const PROBE_ENTRY = 'bench/probe/memoryProbe.ts';

export type Runtime = {
  name: 'docker' | 'local';
  /** Whether this runtime holds the server to the profile's limits. */
  enforcesLimits: boolean;
  /** What the numbers were measured on, recorded with every result. */
  describe: () => Promise<Record<string, string>>;
  launch: (options: LaunchOptions) => Promise<RunningTarget>;
};
