import { hostable } from '@plitzi/sdk-kernel/http';
import { fleetStore } from '@plitzi/sdk-kernel/http';

import { createMemoryJobQueue, JOB_QUEUE_METHODS } from './jobs/memoryQueue';
import { createMemoryKv, KV_METHODS } from './runtime/memoryKv';

import type { ActionKvAdapter } from './types';
import type { JobQueue } from '../types';
import type { FleetStores } from '@plitzi/sdk-kernel/http';

/** The `kv` a deployment keeps somewhere of its own — a file, a database — when the primary is the one that opened it. */
let deploymentKv: ActionKvAdapter | undefined;

/** The job queue the primary made — in memory, a file, a database — for its workers to reach rather than make their own. */
let deploymentJobs: JobQueue | undefined;

/**
 * A `kv` the deployment makes — a file — opened by ONE process of a fleet and reached by the rest: made in the primary
 * (or the single process there is), and in a worker the primary's, over the channel. Made in every worker instead,
 * each would hold its own copy of the file and write it over the others'.
 */
export const fleetKv = (make: () => ActionKvAdapter): ActionKvAdapter => {
  const remote = fleetStore<ActionKvAdapter>('actions.kv', KV_METHODS);
  if (remote) {
    return remote;
  }

  deploymentKv = make();

  return deploymentKv;
};

/**
 * The job queue of a server — ONE for the primary and its workers, as `fleetKv` is: made in the primary (or the single
 * process there is), and in a worker the primary's, over the channel. The primary's jobs made apart from what it offered
 * its workers would be two queues: a worker's `ctx.later` waiting where nobody claims.
 */
export const fleetJobQueue = (make: () => JobQueue): JobQueue => {
  const remote = fleetStore<JobQueue>('actions.jobs', JOB_QUEUE_METHODS);
  if (remote) {
    return remote;
  }

  deploymentJobs = make();

  return deploymentJobs;
};

/**
 * What the primary keeps for its workers of the actions' and the realtime's: the same in-memory defaults a single server
 * makes for itself, made once — when a worker first asks — so the fleet has one of each rather than one per worker.
 */
export const ACTIONS_FLEET_STORES: FleetStores = {
  'actions.kv': hostable(() => deploymentKv ?? createMemoryKv(), KV_METHODS),
  'realtime.kv': hostable(createMemoryKv, KV_METHODS),
  'actions.jobs': hostable(() => deploymentJobs ?? createMemoryJobQueue(), JOB_QUEUE_METHODS)
};
