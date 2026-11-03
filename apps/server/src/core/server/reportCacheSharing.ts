import { DEFAULT_CACHE_BYTES, DEFAULT_TTL_MS } from '../../helpers/cache';
import { serverLog } from '../../helpers/serverLog';

import type { SSRPageServerConfig } from '@plitzi/sdk-shared';

const megabytes = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;
const seconds = (ms: number): string => `${Math.round(ms / 1000)} s`;

/**
 * Says once, where the server starts, how its pages are kept and what an invalidation reaches. The case it is there
 * for is the silent one: several replicas and no bus, where a publish is seen by the replica that was told and by the
 * others only when their copies expire. A development server, one process by nature, is not told what it knows.
 */
export const reportCacheSharing = (
  config: SSRPageServerConfig,
  { ttlMs, bus, store }: { ttlMs: number; bus: boolean; store: boolean }
): void => {
  if (config.devMode && !bus && !store) {
    return;
  }

  const kept =
    `Pages are kept ${seconds(ttlMs)} (served ${seconds(config.cache?.staleMs ?? DEFAULT_TTL_MS.stale)} more while ` +
    `rendered again), up to ${megabytes(config.cache?.maxBytes ?? DEFAULT_CACHE_BYTES.html)} a process`;
  const where = store ? ', and shared by every replica (cache.store)' : ', each process its own';
  const reach = bus
    ? 'an invalidation reaches every replica (cache.bus).'
    : "an invalidation reaches this host's processes only — with several replicas, give the server cache.bus " +
      '(createRedisPubSub) or each serves what a write made untrue until its copy expires.';

  serverLog.info('SSR cache', `${kept}${where}; ${reach}`);
};
