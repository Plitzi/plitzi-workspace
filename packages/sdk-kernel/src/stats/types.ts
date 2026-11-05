/**
 * What a process says of itself (RFC 0032, §7): who it is, how loaded, how its work went over the last minute, quarter
 * and hour, and whether that is healthy. Every server process is built on the kernel, so they all say it the same way —
 * page servers, workers, functions runners — and `readPools` reads them all alike.
 */

/** What a process is configured to report with: the secret `/_stats` is read behind, and the pool it belongs to. */
export type StatsConfig = {
  /** What a reader sends as `Authorization: Bearer <secret>`. At least 32 characters: stats name what runs here. */
  secret: string;
  /** The pool this process is one instance of — `pages`, `worker`, `runner`. */
  pool: string;
  /** This instance's name in its pool. Defaults to the host's name and the process id. */
  instance?: string;
  thresholds?: StatsThresholds;
};

/** Where `degraded` starts. Each is checked against the last fifteen minutes, and the slots and the lag as they are now. */
export type StatsThresholds = {
  /** Failures over runs, from 0 to 1. Asked only once there are 10 runs or more. Default 0.2. */
  errorRate?: number;
  /** The event loop's p99 delay, in ms. Default 500. */
  eventLoopLagMs?: number;
  /** A slot's use over its size, from 0 to 1. Default 0.9. */
  slotShare?: number;
};

/** How work went over one window. Durations are of runs, failed ones included. */
export type StatsWindow = {
  runs: number;
  /** Failed runs, by why: `timeout`, `cpu`, `memory`, `aborted`, `error`… — the reasons the process's work names. */
  failures: Record<string, number>;
  /** Requests that never became runs, by why: `over_capacity`, a version refused (`protocol`), `forbidden`… */
  refusals: Record<string, number>;
  p50Ms?: number;
  p95Ms?: number;
};

/**
 * What a run was: the space it ran for, what kind of thing — an action, or a space function's `task`, `route` or `job`
 * — and its name. Said by whatever records the run, so a slow minute names what made it slow.
 */
export type RunLabel = { spaceId: number; kind: string; name: string; trigger?: string; runId?: string };

/** One run of a minute's slowest, or one that failed: what it was, how long it took, and when it ended. */
export type SlowRun = RunLabel & { at: string; durationMs: number; failure?: string };

/** What one action or function did in a minute, among the ones that took the most of it. */
export type NamedWork = RunLabel & { runs: number; failed: number; totalMs: number; maxMs: number };

/**
 * One minute of a process: its work, and its load as sampled in that minute. A minute with no sample — before the
 * process started, or one its event loop was too busy to take — has no load, never a zero.
 */
export type StatsMinute = {
  /** The minute's start, ISO 8601 in UTC. */
  at: string;
  runs: number;
  failed: number;
  refused: number;
  p95Ms?: number;
  /** Its samples' mean CPU, as a share of one core. */
  cpu?: number;
  /** The most memory a sample saw, in bytes (RSS). */
  rss?: number;
  /** The most event-loop delay a sample saw (p99), in ms. */
  lagMs?: number;
  /** Its slowest runs, and every one that failed, up to {@link MINUTE_RUNS} — absent in a minute nothing ran. */
  runsOf?: SlowRun[];
  /** The actions and functions that took the most of it, up to {@link MINUTE_NAMES}. */
  names?: NamedWork[];
};

/** How many of a minute's runs it keeps by name (its slowest, its failures), and how many of its names. */
export const MINUTE_RUNS = 5;
export const MINUTE_NAMES = 8;

export type ProcessStats = {
  pool: string;
  instance: string;
  version?: string;
  /** The functions protocol it speaks, when it speaks one (a runner, a platform). */
  protocol?: string;
  /** When this was read, ISO 8601 in UTC. */
  at: string;
  uptimeSeconds: number;
  load: {
    /** Work in flight against what this process takes at once: `calls`, `renders`, `isolates`. */
    slots: Record<string, { used: number; of: number }>;
    /** CPU spent over the last sample (ten seconds), as a share of one core over that time. */
    cpu: number;
    memory: { rss: number; heapUsed: number; heapTotal: number };
    /** The event loop's p99 delay over the last sample, in ms. */
    eventLoopLagP99Ms: number;
  };
  outcomes: { '1m': StatsWindow; '15m': StatsWindow; '60m': StatsWindow };
  /** The last hour minute by minute, oldest first: what a chart of this process draws. */
  series: StatsMinute[];
  /**
   * `stopping` once it is told to stop, while it finishes what it runs. `down` is never said by a process: it is a
   * reader's, for an instance that did not answer.
   */
  health: { status: 'healthy' | 'degraded' | 'stopping'; reasons: string[] };
};

/** One instance of a pool, as a pool source knows it. */
export type PoolInstance = {
  id: string;
  /** Where its `/_stats` is answered: an origin, without the path. */
  url: string;
  secret: string;
  /** What its orchestrator knows of it, when it has one: where it is in its life, and what happened to it before. */
  orchestrator?: {
    /**
     * `starting` until it takes work, `running`, `restarting` while a stuck one is replaced, `stopping` while it finishes
     * what it runs, `stopped` once it has, and `failed` when it could not start or ended on its own. A reader asks a
     * `stopped` or `failed` one nothing.
     */
    phase?: InstancePhase;
    /** What the phase means here, in words: why it failed, who stopped it. */
    why?: string;
    restarts?: number;
    lastExit?: string;
  };
};

/** Where an instance is in its life, as its orchestrator knows it. */
export type InstancePhase = 'starting' | 'running' | 'restarting' | 'stopping' | 'stopped' | 'failed';

/**
 * How an instance is, as a reader says it: its phase where that says it all — starting, stopping, stopped, failed — and
 * otherwise what it answered: `healthy`, `degraded`, or `down` for one that should answer and did not.
 */
export type InstanceStatus = Exclude<InstancePhase, 'running'> | 'healthy' | 'degraded' | 'down';

/** Which instances each pool has, and where to reach them. A deployment on an orchestrator supplies its own. */
export type PoolSource = {
  pools: () => Promise<{ pool: string; instances: PoolInstance[] }[]>;
};

export type InstanceHealth = {
  id: string;
  status: InstanceStatus;
  /** How long its `/_stats` took to answer, in ms: the round trip to it, as the reader sees it. */
  latencyMs?: number;
  /** Why it is down, or what made it degraded. */
  reasons: string[];
  stats?: ProcessStats;
  orchestrator?: PoolInstance['orchestrator'];
};

export type PoolReport = {
  pool: string;
  instances: InstanceHealth[];
  counts: Record<InstanceStatus, number>;
  /** Every version its instances answered with: more than one is a rolling deploy, or one that stopped half-way. */
  versions: string[];
};

/** Every pool, read at once. Without a source it says so, never an empty list that reads as "nothing runs". */
export type PoolHealth = { at: string; pools: PoolReport[] } | { at: string; unconfigured: string };

/** A floor held above a pool's own for a while, by somebody, for a reason: what the screen lists and anyone may end. */
export type PoolOverride = {
  pool: string;
  floor: number;
  reason: string;
  /** Who set it, as the deployment names its people. */
  by: string;
  /** When the pool's own floor comes back, ISO 8601 in UTC. */
  expiresAt: string;
};

/**
 * What changes a pool's capacity when an autoscaler does not, for a deployment that has one: the kernel defines it and
 * ships none. Without one a pool is shown read-only, and the screen says scaling is not managed from there. A floor is
 * raised or lowered, never the count: an autoscaler keeps owning the count above it.
 */
export type PoolScaler = {
  /** The pools it can change, by name. */
  pools: () => string[];
  /** Its floor now, its own floor (what an override ends back to), its ceiling, and how many instances it has. */
  read: (pool: string) => Promise<{ floor: number; defaultFloor: number; ceiling: number; current: number }>;
  /** Holds the pool at `floor` or more until `expiresAt`. Refused past its ceiling, saying so. */
  setFloor: (pool: string, floor: number, override: Omit<PoolOverride, 'pool' | 'floor'>) => Promise<void>;
  /** Ends an override now: the pool's own floor again. */
  endOverride: (pool: string) => Promise<void>;
  overrides: () => Promise<PoolOverride[]>;
  /**
   * Stops one instance: it is taken out of rotation at once, finishes what it runs, and then goes — the pool reads it
   * `stopping` meanwhile. Answers what was done, in words. Absent where the orchestrator decides which instance goes (an
   * autoscaler lowers the count from the floor).
   */
  stopInstance?: (pool: string, id: string, by: string) => Promise<string>;
  /**
   * Replaces one instance: out of rotation, it finishes what it runs — or, stuck, is cut — and a new one starts in its
   * place, read `restarting` meanwhile. Answers what was done, in words. Absent where the orchestrator restarts its own.
   */
  restartInstance?: (pool: string, id: string, by: string) => Promise<string>;
};
