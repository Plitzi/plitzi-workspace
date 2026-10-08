import { readHtmlCacheKey, readOfflineDataCacheKey, readRscCacheKey } from './keys';

import type { CacheKeyFacts } from './keys';
import type { ServerCaches } from './serverCaches';
import type { TtlCache } from './TtlCache';
import type { CacheFilter, CacheManager } from '@plitzi/sdk-shared';

type ReadableCache = { store: TtlCache<unknown>; read: (key: string) => CacheKeyFacts };

/**
 * Whether an entry is one the filter names. An entry that is not any one host's (the space as read for a render) is
 * named by a filter on a host too: the page that host serves is rendered from it, and dropping the page while keeping
 * it would render the same page again.
 */
const matches = (facts: CacheKeyFacts, filter: CacheFilter): boolean =>
  (filter.spaceId === undefined || facts.spaceId === String(filter.spaceId)) &&
  (filter.environment === undefined || facts.environment === filter.environment) &&
  (filter.hostname === undefined || facts.hostname === undefined || facts.hostname === filter.hostname);

const clearCounted = (store: TtlCache<unknown>): number => {
  const count = store.size;
  store.clear();

  return count;
};

/**
 * `server.cache` over every cache a render is kept in: the pages, the RSC answers, and the space as read for both.
 *
 * All three, because they hold one change between them. Dropping the pages alone left the space they were rendered
 * from, and the next request rendered the page that had just been dropped from it — an invalidation that cleared
 * every page and changed none of them.
 */
export const buildCacheManager = ({ html, rsc, offlineData }: ServerCaches): CacheManager => {
  const caches: ReadableCache[] = [
    ...(html ? [{ store: html, read: readHtmlCacheKey }] : []),
    ...(rsc ? [{ store: rsc, read: readRscCacheKey }] : []),
    ...(offlineData ? [{ store: offlineData, read: readOfflineDataCacheKey }] : [])
  ];

  return {
    invalidate(filter?: CacheFilter): number {
      if (!filter || Object.keys(filter).length === 0) {
        return caches.reduce((count, { store }) => count + clearCounted(store), 0);
      }

      return caches.reduce(
        (count, { store, read }) => count + store.invalidateWhere(key => matches(read(key), filter)),
        0
      );
    },
    clear() {
      caches.forEach(({ store }) => store.clear());
    },
    get size() {
      return caches.reduce((count, { store }) => count + store.size, 0);
    }
  };
};
