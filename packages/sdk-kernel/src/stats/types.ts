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
    /** CPU spent since the last read, as a share of one core over that time. */
    cpu: number;
    memory: { rss: number; heapUsed: number; heapTotal: number };
    eventLoopLagP99Ms: number;
  };
  outcomes: { '1m': StatsWindow; '15m': StatsWindow; '60m': StatsWindow };
  /** `down` is never said by a process: it is a reader's, for an instance that did not answer. */
  health: { status: 'healthy' | 'degraded'; reasons: string[] };
};

/** One instance of a pool, as a pool source knows it. */
export type PoolInstance = {
  id: string;
  /** Where its `/_stats` is answered: an origin, without the path. */
  url: string;
  secret: string;
  /** What its orchestrator knows of it, when it has one. */
  orchestrator?: { ready?: boolean; restarts?: number; lastExit?: string };
};

/** Which instances each pool has, and where to reach them. A deployment on an orchestrator supplies its own. */
export type PoolSource = {
  pools: () => Promise<{ pool: string; instances: PoolInstance[] }[]>;
};

export type InstanceHealth = {
  id: string;
  status: 'healthy' | 'degraded' | 'down';
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
  counts: { healthy: number; degraded: number; down: number };
  /** Every version its instances answered with: more than one is a rolling deploy, or one that stopped half-way. */
  versions: string[];
};

/** Every pool, read at once. Without a source it says so, never an empty list that reads as "nothing runs". */
export type PoolHealth = { at: string; pools: PoolReport[] } | { at: string; unconfigured: string };

/**
 * What changes a pool's capacity when an autoscaler does not, for a deployment that has one: the kernel defines it and
 * ships none. Without one a pool is shown read-only, and the screen says scaling is not managed from there.
 */
export type PoolScaler = {
  read: (pool: string) => Promise<{ floor: number; ceiling: number; current: number }>;
  /** Holds the pool at `floor` or more until `expiresAt` (ISO 8601, UTC), saying why. */
  setFloor: (pool: string, floor: number, override: { reason: string; expiresAt: string }) => Promise<void>;
  overrides: () => Promise<{ pool: string; floor: number; reason: string; expiresAt: string }[]>;
};
