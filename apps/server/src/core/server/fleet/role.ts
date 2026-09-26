import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

/**
 * Where a server decides whether it runs as one process or as several — the one fork between the two modes.
 *
 * - `single`: workers off, one asked for, or one core to run on. Everything is what it always was: the stores are
 *   this process's own, `server.cache` is its own, nothing listens on a channel and nothing is forked.
 * - `primary`: the process that was started, asked for more than one. It serves nothing: it forks the workers,
 *   restarts the ones that die (`supervisor.ts`) and keeps, for all of them, the stores a single process keeps
 *   in memory (`stores.ts`).
 * - `worker`: forked by a primary. It serves, and reaches those stores — and tells the other workers what they must
 *   hear — over the channel to its primary (`link.ts`).
 *
 * Every other file in this folder serves the last two; the rest of the server asks only `fleetRole`,
 * `runsFleetJobs` and, for a store, `fleetStore` (which answers nothing outside a worker).
 */

export type WorkersOption = boolean | number | 'auto';

/** What the deployment's environment says, when its code says nothing: `SDK_SERVER_WORKERS=1`, `=auto`, `=false`. */
const fromEnvironment = (raw: string | undefined): WorkersOption | undefined => {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }

  const value = raw.trim().toLowerCase();
  if (value === 'auto' || value === 'true') {
    return 'auto';
  }

  if (value === 'false' || value === 'off') {
    return false;
  }

  return Number(value);
};

export type WorkersPlan = {
  /** The processes that will serve. */
  count: number;
  /** What was asked for, when it was more than the cores there are — and so was lowered to them. */
  requested?: number;
};

/**
 * How many processes serve the port.
 *
 * On by default in production — one per core the process may use, which `availableParallelism` reads from the
 * container's CPU quota too, so a quarter-core container gets one. Off by default anywhere else: a development server
 * under `--watch` or a debugger, and a test runner that starts servers in its own process, must stay one process.
 * The config wins over `SDK_SERVER_WORKERS`, which wins over the default.
 *
 * A number is a ceiling, not a demand: more processes than cores only take turns on the same cores, each with its
 * own memory, so it is lowered to the cores there are and the plan says it was.
 */
export const resolveWorkers = (
  option: WorkersOption | undefined,
  environment: NodeJS.ProcessEnv = process.env,
  cores: number = availableParallelism()
): WorkersPlan => {
  const available = Math.max(1, cores);
  const chosen =
    option ??
    fromEnvironment(environment.SDK_SERVER_WORKERS) ??
    (environment.NODE_ENV === 'production' ? 'auto' : false);
  if (chosen === false) {
    return { count: 1 };
  }

  if (chosen === true || chosen === 'auto') {
    return { count: available };
  }

  if (!Number.isInteger(chosen) || chosen < 1) {
    throw new Error(`workers must be true, false, 'auto' or a whole number from 1 — got ${String(chosen)}`);
  }

  return chosen > available ? { count: available, requested: chosen } : { count: chosen };
};

/**
 * Only a worker a primary of ours forked carries this: a process that is a cluster worker of something else —
 * PM2's cluster mode, a deployment's own `cluster.fork` — is a single server, with nobody to answer its calls.
 */
const FLEET_ENV = 'SDK_SERVER_FLEET';
const JOBS_ENV = 'SDK_SERVER_FLEET_JOBS';

/** The environment the primary gives a worker it forks — and the one worker that carries the fleet's jobs. */
export const fleetWorkerEnv = (runsJobs: boolean): Record<string, string> => ({
  [FLEET_ENV]: '1',
  [JOBS_ENV]: runsJobs ? '1' : '0'
});

export const isFleetWorker = (): boolean => cluster.isWorker && process.env[FLEET_ENV] === '1';

export type FleetRole = 'single' | 'primary' | 'worker';

export const fleetRole = (plan: WorkersPlan): FleetRole => {
  if (isFleetWorker()) {
    return 'worker';
  }

  return plan.count > 1 && cluster.isPrimary ? 'primary' : 'single';
};

/**
 * Whether this process runs the scheduler and the job consumers.
 *
 * A single server, yes, as it always did. Of a fleet, one worker only: its workers are one replica, and a replica's
 * `jobs` settings — how many run at once, whether it schedules at all — are for the replica, not for each of its
 * processes. The primary hands the role to the replacement of the worker that carried it.
 */
export const runsFleetJobs = (): boolean => !isFleetWorker() || process.env[JOBS_ENV] === '1';
