import queryCache from './queryCache';

import type { QueryMeta } from './queryCache';

export { QueryCache, GC_TIME, queryId, queryPath } from './queryCache';
export { default as useQuery } from './useQuery';

export type { QueriesState, QueryEntry, QueryMeta, QueryObserverOptions } from './queryCache';
export type { UseQueryOptions, UseQueryResult } from './useQuery';

/** Relative URLs resolve against the page; outside a browser there is no page, and only absolute ones resolve. */
const base = (): string | undefined => (typeof location === 'undefined' ? undefined : location.href);

const originOf = (url: string): string | undefined => {
  try {
    return new URL(url, base()).origin;
  } catch {
    return undefined;
  }
};

/**
 * Every query that could have read what `url` just wrote: the ones on the same origin.
 *
 * The origin, not the path: `POST /api/cart/items` changes what `GET /api/cart` answers, and no path rule tells
 * those apart from two unrelated resources. Another origin is another backend, and nothing it writes shows up here.
 */
export const invalidateQueriesForWrite = (url: string): Promise<void> => {
  const origin = originOf(url);
  if (!origin) {
    return Promise.resolve();
  }

  return queryCache.invalidate((meta: QueryMeta) => originOf(meta.url) === origin);
};

/**
 * Every query whose URL starts with `prefix`, or all of them without one — the `invalidateQueries` step.
 *
 * Compared resolved, so `/api/orders` written in a flow matches the `https://host/api/orders?page=2` a provider
 * asked for.
 */
export const invalidateQueries = (prefix = ''): Promise<void> => {
  if (!prefix) {
    return queryCache.invalidate();
  }

  const resolve = (url: string) => {
    try {
      return new URL(url, base()).href;
    } catch {
      return url;
    }
  };
  const target = resolve(prefix);

  return queryCache.invalidate(meta => resolve(meta.url).startsWith(target));
};

export { queryCache };
