import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use, useMemo } from 'react';
import useSWR from 'swr';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { MutationsMap } from '../Mutations';
import type { QueriesMap } from '../Queries';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { KeyedMutator, SWRConfiguration } from 'swr';

function useGraphQL<K extends keyof QueriesMap>(
  queryKey: K | null,
  transform?: undefined,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<QueriesMap[K]>
): {
  data: QueriesMap[K] | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<QueriesMap[K]>;
};

function useGraphQL<K extends keyof QueriesMap, TK>(
  queryKey: K | null,
  transform: (data: QueriesMap[K] | undefined) => TK | undefined,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<QueriesMap[K]>
): {
  data: TK | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<QueriesMap[K]>;
};
function useGraphQL<K extends keyof QueriesMap, TK>(
  queryKey: K | null,
  transform?: (data: QueriesMap[K] | undefined) => TK | undefined,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<QueriesMap[K]>
  // mode: 'query' | 'mutate' = 'query'
) {
  const { query } = use(NetworkContext) as NetworkContextValue<QueriesMap, MutationsMap>;
  const fetcher = useMemo(() => (qKey: K, variables?: Record<string, unknown>) => query(qKey, variables), [query]);
  const transformMemo = useValueMemo(transform, 'soft', { skipFunctions: true });
  const swrFetcher = useMemo(
    () =>
      ([qKey, vars]: [qKey: K, vars: Record<string, unknown>]) =>
        fetcher(qKey, vars),
    [fetcher]
  );

  const { data, error, isLoading, mutate } = useSWR<QueriesMap[K], Error>([queryKey, variables], swrFetcher, config);
  const dataParsed = useMemo(() => transformMemo?.(data) ?? data, [data, transformMemo]);

  return { data: dataParsed, error, isLoading, mutate };
}

export default useGraphQL;
