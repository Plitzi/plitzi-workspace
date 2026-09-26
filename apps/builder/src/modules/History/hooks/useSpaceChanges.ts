import { use, useCallback, useEffect, useMemo, useRef } from 'react';
import useSWRInfinite from 'swr/infinite';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import type { BuilderMutationsMap, BuilderQueriesMap, ChangeOrigin, TSpaceChanges } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type ChangeFilters = { origin?: ChangeOrigin; entityId?: string; since?: number };

type PageKey = readonly ['SpaceChanges', Record<string, unknown>];

const PAGE_SIZE = 50;

/**
 * The space's change history, a page at a time, newest first.
 *
 * Read again each time the save queue drains, like the problems list: the server records a change when it saves, so
 * that is when there is something new to show — and every loaded page is revalidated, since a filter can move rows.
 */
const useSpaceChanges = (filters: ChangeFilters) => {
  const { query } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const processing = use(QueueStatusContext);
  const wasProcessing = useRef(processing);

  const keyOf = useCallback(
    (index: number, previous: TSpaceChanges | null): PageKey | null => {
      if (previous?.nextBefore === null) {
        return null;
      }

      const variables = { environment: 'main', limit: PAGE_SIZE, ...filters };

      return ['SpaceChanges', index > 0 && previous ? { ...variables, before: previous.nextBefore } : variables];
    },
    [filters]
  );

  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<
    TSpaceChanges | undefined,
    Error,
    typeof keyOf
  >(keyOf, async ([name, variables]: PageKey) => (await query(name, variables)).result?.SpaceChanges, {
    revalidateOnFocus: false
  });

  useEffect(() => {
    if (wasProcessing.current && !processing) {
      void mutate();
    }

    wasProcessing.current = processing;
  }, [processing, mutate]);

  const pages = useMemo(() => (data ?? []).filter((page): page is TSpaceChanges => page !== undefined), [data]);
  const loadMore = useCallback(() => void setSize(size + 1), [setSize, size]);
  const refresh = useCallback(() => void mutate(), [mutate]);

  return {
    changes: pages.flatMap(page => page.changes),
    snapshots: pages[0]?.snapshots ?? [],
    complete: pages.at(-1)?.nextBefore === null,
    loading: isLoading,
    error,
    loadMore,
    refresh
  };
};

export default useSpaceChanges;
