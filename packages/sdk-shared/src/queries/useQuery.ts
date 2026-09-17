import { useCallback, useEffect, useRef } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';

import queryCache, { GC_TIME, queryPath } from './queryCache';

import type { QueriesState, QueryMeta } from './queryCache';

export type UseQueryOptions<T> = {
  /** What identifies the answer. Without one the hook is inert: it reads, holds and asks for nothing. */
  key: string | undefined;
  meta: QueryMeta;
  fetcher: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  /** How long an answer counts as current, in milliseconds. */
  staleTime: number;
  /** How long an answer nobody renders is kept, in milliseconds. `0` forgets it on unmount. */
  gcTime?: number;
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
  gcTime = GC_TIME,
  isCacheable
}: UseQueryOptions<T>): UseQueryResult<T> => {
  const active = key !== undefined;
  const [stored] = useQueriesStore(queryPath(key ?? ''), { store: queryCache.store, enabled: active });
  const entry = active && stored?.key === key ? stored : undefined;
  const answered = entry !== undefined && queryCache.hasAnswer(entry.key);

  // The fetcher closes over whatever the caller rendered with; the cache only ever needs the latest one, and making
  // it a dependency would re-observe — and re-check freshness — on every render of a caller that inlines it.
  const fetcherRef = useRef(fetcher);
  const isCacheableRef = useRef(isCacheable);
  useEffect(() => {
    fetcherRef.current = fetcher;
    isCacheableRef.current = isCacheable;
  }, [fetcher, isCacheable]);

  useEffect(() => (key === undefined ? undefined : queryCache.hold(key, gcTime)), [key, gcTime]);

  const { url } = meta;
  // Joined, so a caller building the list on every render does not re-observe for the same tags.
  const tagsKey = meta.tags?.join('\u0000') ?? '';
  useEffect(() => {
    if (!enabled || key === undefined) {
      return undefined;
    }

    return queryCache.observe<T>(key, {
      meta: { url, tags: tagsKey ? tagsKey.split('\u0000') : [] },
      staleTime,
      fetcher: signal => fetcherRef.current(signal),
      isCacheable: data => isCacheableRef.current?.(data) ?? true
    });
  }, [enabled, key, url, tagsKey, staleTime]);

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
  const isFetching = (entry?.isFetching ?? false) || (enabled && active && !answered);

  const refetch = useCallback(() => {
    if (enabled && key !== undefined) {
      void queryCache.refetch(key);
    }
  }, [enabled, key]);

  return { data, isFetching, isLoading: isFetching && data === undefined, refetch };
};

export default useQuery;
