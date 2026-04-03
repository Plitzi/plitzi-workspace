import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use, useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderMutationsMap, BuilderQueriesMap, PageInfo } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { SWRInfiniteConfiguration } from 'swr/infinite';

const useInfiniteGraphQL = <K extends keyof BuilderQueriesMap, T>(
  queryKey: K | null,
  transform: (data: BuilderQueriesMap[K] | undefined) => { edges: T[]; pageInfo: PageInfo } | undefined,
  variables?: Record<string, unknown>,
  config?: SWRInfiniteConfiguration<BuilderQueriesMap[K]> & { pageSize?: number }
  // mode: 'query' | 'mutate' = 'query'
) => {
  const { query } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const { pageSize = 10 } = config ?? {};
  const transformMemo = useValueMemo(transform, 'soft', { skipFunctions: true });

  const fetcher = useMemo(() => (qKey: K, variables?: Record<string, unknown>) => query(qKey, variables), [query]);
  const swrFetcher = useMemo(
    () =>
      async ([qKey, vars]: [qKey: K, vars: Record<string, unknown>]) =>
        (await fetcher(qKey, vars)).result as BuilderQueriesMap[K],
    [fetcher]
  );

  const getKey = useCallback(
    (page: number, previousPageData: BuilderQueriesMap[K] | null) => {
      if (!queryKey) {
        return null;
      }

      const previousPageDataParsed = previousPageData ? transformMemo(previousPageData) : undefined;
      if (previousPageDataParsed && !previousPageDataParsed.pageInfo.hasNextPage) {
        return null;
      }

      return [queryKey, { ...variables, page, pageSize: pageSize }] as const;
    },
    [pageSize, queryKey, transformMemo, variables]
  );

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<BuilderQueriesMap[K], Error>(
    getKey,
    swrFetcher,
    config
  );

  const isEmpty = (data?.[data.length - 1] && !transformMemo(data[data.length - 1])?.pageInfo.hasNextPage) ?? true;
  const dataParsed = useMemo(
    () => data?.flatMap(subData => transformMemo(subData)?.edges) ?? [],
    [data, transformMemo]
  );

  return {
    data: dataParsed,
    error,
    size,
    setSize,
    isLoading: !data && isValidating,
    isValidating,
    isEmpty,
    mutate
  };
};

export default useInfiniteGraphQL;
