import { hostable } from './channel';
import { createMemoryJobQueue, JOB_QUEUE_METHODS } from '../../../modules/actions/jobs/memoryQueue';
import { createMemoryKv, KV_METHODS } from '../../../modules/actions/runtime/memoryKv';
import { createMemoryDraftStore, DRAFT_STORE_METHODS } from '../../../modules/ssr/preview';
import { createMemoryRateLimit, RATE_LIMIT_METHODS } from '../../auth/throttle';

import type { HostedStore } from './channel';
import type { FleetStoreName } from './link';

/**
 * What the primary keeps for its workers: the same in-memory defaults a single server makes for itself, made here
 * once — when a worker first asks — so the fleet has one of each rather than one per worker.
 */
export const FLEET_STORES: Readonly<Record<FleetStoreName, HostedStore>> = {
  'actions.kv': hostable(createMemoryKv, KV_METHODS),
  'actions.jobs': hostable(() => createMemoryJobQueue(), JOB_QUEUE_METHODS),
  'ssr.drafts': hostable(createMemoryDraftStore, DRAFT_STORE_METHODS),
  'auth.rateLimit': hostable(() => ({ check: createMemoryRateLimit() }), RATE_LIMIT_METHODS)
};
