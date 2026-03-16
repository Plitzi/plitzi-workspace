import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use, useMemo } from 'react';
import useSWR from 'swr';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderMutationsMap, BuilderQueriesMap } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { KeyedMutator, SWRConfiguration } from 'swr';

function useGraphQL<K extends keyof BuilderQueriesMap>(
  queryKey: K | null,
  transform?: undefined,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<BuilderQueriesMap[K]>
): {
  data: BuilderQueriesMap[K] | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<BuilderQueriesMap[K]>;
};

function useGraphQL<K extends keyof BuilderQueriesMap, TK>(
  queryKey: K | null,
  transform: (data: BuilderQueriesMap[K] | undefined) => TK | undefined,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<BuilderQueriesMap[K]>
): {
  data: TK | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<BuilderQueriesMap[K]>;
};
function useGraphQL<K extends keyof BuilderQueriesMap, TK>(
  queryKey: K | null,
  transform?: (data: BuilderQueriesMap[K] | undefined) => TK | undefined,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<BuilderQueriesMap[K]>
  // mode: 'query' | 'mutate' = 'query'
) {
  const { query } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const fetcher = useMemo(() => (qKey: K, variables?: Record<string, unknown>) => query(qKey, variables), [query]);
  const transformMemo = useValueMemo(transform, 'soft', { skipFunctions: true });
  const swrFetcher = useMemo(
    () =>
      async ([qKey, vars]: [qKey: K, vars: Record<string, unknown>]) =>
        (await fetcher(qKey, vars)).result as BuilderQueriesMap[K],
    [fetcher]
  );

  const { data, error, isLoading, mutate } = useSWR<BuilderQueriesMap[K], Error>(
    queryKey ? [queryKey, variables] : queryKey,
    swrFetcher,
    config
  );
  const dataParsed = useMemo(() => (transformMemo ? transformMemo(data) : data), [data, transformMemo]);

  return { data: dataParsed, error, isLoading, mutate };
}

export default useGraphQL;
