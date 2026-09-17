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

/** Ids written as a step writes them — `orders, members` — into a list, blanks dropped. */
export const parseIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map(id => id.trim());
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
};

/** What an invalidation picks: requests whose URL starts with `url`, and/or the ones the named elements made. */
export type QuerySelector = { url?: string; elements?: readonly string[] };

const resolveUrl = (url: string): string => {
  try {
    return new URL(url, base()).href;
  } catch {
    return url;
  }
};

/**
 * The queries a selector picks — every one of them for an empty selector. Both parts must hold when both are given.
 *
 * The URL is compared resolved, so `/api/orders` matches the `https://host/api/orders?page=2` a provider asked for.
 * An element is named by its id, which is the tag its requests carry: the way to reach a request whose URL is a
 * template nobody can write down.
 */
export const matchesQuery = ({ url, elements }: QuerySelector) => {
  const target = url ? resolveUrl(url) : undefined;

  return (meta: QueryMeta): boolean =>
    (target === undefined || resolveUrl(meta.url).startsWith(target)) &&
    (!elements?.length || elements.some(id => meta.tags?.includes(id) ?? false));
};

/** The `invalidateQueries` step, and anything else that knows which data changed. */
export const invalidateQueries = (selector: QuerySelector = {}): Promise<void> =>
  selector.url || selector.elements?.length ? queryCache.invalidate(matchesQuery(selector)) : queryCache.invalidate();

/**
 * One key for one request, whoever makes it — an api container and a webhook step asking the same thing share the
 * answer. The headers carry the visitor's token, so two visitors never share one; sorted, so the order somebody
 * typed them in does not split one; and without `Content-Type`, which says how a body is written, not what comes back.
 */
export const requestKey = ({
  method,
  url,
  credentials,
  headers
}: {
  method: string;
  url: string;
  credentials: string;
  headers: Record<string, string>;
}): string =>
  JSON.stringify([
    method.toLowerCase(),
    url,
    credentials,
    Object.entries(headers)
      .filter(([name]) => name.toLowerCase() !== 'content-type')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  ]);

export { queryCache };

/** What a write step refreshes when it succeeds. `origin` needs the URL the write went to. */
export type WriteInvalidation = 'origin' | 'all' | 'elements' | 'none';

/**
 * The refresh a write step asked for, once it succeeded.
 *
 * `elements` with no ids refreshes nothing: an author who picked "these containers" and named none did not mean all
 * of them. A mode nobody recognises is treated as the caller's default rather than as `none`, so a typo still
 * refreshes the page instead of leaving it showing data from before the write.
 */
export const invalidateAfterWrite = ({
  mode,
  fallback,
  elements,
  url
}: {
  mode: unknown;
  fallback: WriteInvalidation;
  elements?: unknown;
  url?: string;
}): Promise<void> => {
  const chosen = mode === 'origin' || mode === 'all' || mode === 'elements' || mode === 'none' ? mode : fallback;
  if (chosen === 'none') {
    return Promise.resolve();
  }

  if (chosen === 'elements') {
    const ids = parseIds(elements);

    return ids.length > 0 ? invalidateQueries({ elements: ids }) : Promise.resolve();
  }

  if (chosen === 'origin' && url) {
    return invalidateQueriesForWrite(url);
  }

  return invalidateQueries();
};
