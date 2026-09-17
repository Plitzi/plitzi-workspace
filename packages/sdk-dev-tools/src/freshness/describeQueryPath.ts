import { queryCache } from '@plitzi/sdk-shared/queries';

import type { DescribePath } from './rows';

// Compared by identity only: the registry types its stores loosely, and the cache's is one of them.
const queriesStore: object = queryCache.store;
const prefix = 'entries.';

const entryAt = (store: object, path: string) => {
  if (store !== queriesStore || !path.startsWith(prefix)) {
    return undefined;
  }

  return queryCache.store.getState().entries[path.slice(prefix.length)];
};

/**
 * A query cache path, read as the request it holds and as what is keeping it.
 *
 * The cache keys its entries by a hash of the request, because a URL is full of the store's path separator — so the
 * path alone (`entries.22yn2ezdarx`) says nothing about which provider asked. The entry itself carries the URL and the
 * tags, and a provider's tag is its element id.
 *
 * The usage is the other half, and the one that stops a panel reading as a leak: an answer nobody renders is kept on
 * purpose, so that coming back within the grace period paints at once. Saying which of the two a row is — and when the
 * grace period runs out — is the difference between "this page is holding rubbish" and "this page is holding this".
 */
const describeQueryPath: DescribePath = (group, path) => {
  const entry = entryAt(group.entry.store, path);
  if (!entry) {
    return undefined;
  }

  const usage = queryCache.usage(entry.key);

  return {
    label: entry.url,
    tags: entry.tags,
    usage: usage && { inUse: usage.observers > 0 || usage.holds > 0, collectAt: usage.collectAt }
  };
};

/**
 * Lets go of a cached answer now, rather than at the end of its grace period.
 *
 * Here rather than in the panel because only this file knows a query path from any other: the cache has to be told,
 * so that the request still out for it is dropped too and the next reader asks afresh. Answers false for a path this
 * does not own, and for a query something still renders — that one has nothing to ask again with.
 */
// The store is only ever compared by identity, so it is taken as loosely as the registry hands it over.
export const forgetQueryPath = (store: object, path: string): boolean => {
  const entry = entryAt(store, path);

  return entry ? queryCache.remove(entry.key) : false;
};

export default describeQueryPath;
