import { queryCache } from '@plitzi/sdk-shared/queries';

import type { DescribePath } from '../components/FreshnessPanel/helpers';

// Compared by identity only: the registry types its stores loosely, and the cache's is one of them.
const queriesStore: object = queryCache.store;
const prefix = 'entries.';

/**
 * A query cache path, read as the request it holds.
 *
 * The cache keys its entries by a hash of the request, because a URL is full of the store's path separator — so the
 * path alone (`entries.22yn2ezdarx`) says nothing about which provider asked. The entry itself carries the URL and the
 * tags, and a provider's tag is its element id.
 */
const describeQueryPath: DescribePath = (group, path) => {
  if (group.entry.store !== queriesStore || !path.startsWith(prefix)) {
    return undefined;
  }

  const entry = queryCache.store.getState().entries[path.slice(prefix.length)];

  return entry ? { label: entry.url, tags: entry.tags } : undefined;
};

export default describeQueryPath;
