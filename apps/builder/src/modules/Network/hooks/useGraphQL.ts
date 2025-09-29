import { use, useMemo } from 'react';
import useSWR from 'swr';

import NetworkContext from '../NetworkContext';

import type { QueriesMap } from '../Queries';
import type { SWRConfiguration } from 'swr';

const useGraphQL = <K extends keyof QueriesMap>(
  queryKey: K | null,
  variables?: Record<string, unknown>,
  config?: SWRConfiguration<QueriesMap[K]>
  // mode: 'query' | 'mutate' = 'query'
) => {
  const { query } = use(NetworkContext);
  const fetcher = useMemo(() => (qKey: K, variables?: Record<string, unknown>) => query(qKey, variables), [query]);
  const swrFetcher = useMemo(
    () =>
      ([qKey, vars]: [qKey: K, vars: Record<string, unknown>]) =>
        fetcher(qKey, vars),
    [fetcher]
  );

  const { data, error, isLoading, mutate } = useSWR<QueriesMap[K], Error>([queryKey, variables], swrFetcher, config);

  return { data, error, isLoading, mutate };
};

export default useGraphQL;
