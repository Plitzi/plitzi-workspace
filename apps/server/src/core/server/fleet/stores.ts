import { hostable } from './channel';
import { fleetStore } from './link';
import { createMemoryJobQueue, JOB_QUEUE_METHODS } from '../../../modules/actions/jobs/memoryQueue';
import { createMemoryKv, KV_METHODS } from '../../../modules/actions/runtime/memoryKv';
import { createMemoryDraftStore, DRAFT_STORE_METHODS } from '../../../modules/ssr/preview';
import { createMemoryRateLimit, RATE_LIMIT_METHODS } from '../../auth/throttle';

import type { HostedStore } from './channel';
import type { FleetStoreName } from './link';
import type { ActionKvAdapter } from '../../../modules/actions/types';

/** The `kv` a deployment keeps somewhere of its own — a file, a database — when the primary is the one that opened it. */
let deploymentKv: ActionKvAdapter | undefined;

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
 * What the primary keeps for its workers: the same in-memory defaults a single server makes for itself, made here
 * once — when a worker first asks — so the fleet has one of each rather than one per worker.
 */
export const FLEET_STORES: Readonly<Record<FleetStoreName, HostedStore>> = {
  'actions.kv': hostable(() => deploymentKv ?? createMemoryKv(), KV_METHODS),
  'realtime.grants': hostable(createMemoryKv, KV_METHODS),
  'actions.jobs': hostable(() => createMemoryJobQueue(), JOB_QUEUE_METHODS),
  'ssr.drafts': hostable(createMemoryDraftStore, DRAFT_STORE_METHODS),
  'auth.rateLimit': hostable(() => ({ check: createMemoryRateLimit() }), RATE_LIMIT_METHODS)
};
