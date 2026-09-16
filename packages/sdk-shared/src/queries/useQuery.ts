import { useCallback, useEffect, useRef } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';

import queryCache, { queryPath } from './queryCache';

import type { QueriesState, QueryMeta } from './queryCache';

export type UseQueryOptions<T> = {
  key: string;
  meta: QueryMeta;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  /** How long an answer counts as current, in milliseconds. */
  staleTime: number;
  isCacheable?: (data: T) => boolean;
};

export type UseQueryResult<T> = {
  data?: T;
  /** A request is in flight, or about to be for a query that has never been answered. */
  isFetching: boolean;
  /** Nothing to render with yet — as opposed to a refresh of something already on screen. */
  isLoading: boolean;
  refetch: () => void;
};

const { useStore: useQueriesStore } = createStoreHook<QueriesState>();

const useQuery = <T>({
  key,
  meta,
  fetcher,
  enabled = true,
  staleTime,
  isCacheable
}: UseQueryOptions<T>): UseQueryResult<T> => {
  const [stored] = useQueriesStore(queryPath(key), { store: queryCache.store });
  const entry = stored?.key === key ? stored : undefined;
  const answered = entry !== undefined && queryCache.hasAnswer(key);

  // The fetcher closes over whatever the caller rendered with; the cache only ever needs the latest one, and making
  // it a dependency would re-observe — and re-check freshness — on every render of a caller that inlines it.
  const fetcherRef = useRef(fetcher);
  const isCacheableRef = useRef(isCacheable);
  useEffect(() => {
    fetcherRef.current = fetcher;
    isCacheableRef.current = isCacheable;
  }, [fetcher, isCacheable]);

  useEffect(() => queryCache.hold(key), [key]);

  const { url } = meta;
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return queryCache.observe<T>(key, {
      meta: { url },
      staleTime,
      fetcher: () => fetcherRef.current(),
      isCacheable: data => isCacheableRef.current?.(data) ?? true
    });
  }, [enabled, key, url, staleTime]);

  // The store holds every query of the page, so it cannot carry each one's type; this key's data only ever comes
  // from this key's fetcher, whose `T` is the caller's.
  const current = answered ? (entry.data as T | undefined) : undefined;

  /**
   * The last answer shown, kept while a new key has none of its own.
   *
   * A bound URL that changes — a search box, a page number — is a new key, and reporting "nothing yet" for it
   * unmounts whatever the provider feeds until the answer lands. The epoch keeps a previous session's answer out.
   */
  const previous = useRef<{ epoch: number; data: T } | undefined>(undefined);
  if (current !== undefined) {
    previous.current = { epoch: queryCache.epoch, data: current };
  } else if (previous.current && previous.current.epoch !== queryCache.epoch) {
    previous.current = undefined;
  }

  const data = current ?? previous.current?.data;
  const isFetching = (entry?.isFetching ?? false) || (enabled && !answered);

  const refetch = useCallback(() => {
    if (enabled) {
      void queryCache.refetch(key);
    }
  }, [enabled, key]);

  return { data, isFetching, isLoading: isFetching && data === undefined, refetch };
};

export default useQuery;
