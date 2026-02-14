import { useMemo } from 'react';

import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';

import type { ElementBinding, UseDataSourceFilter } from '@plitzi/sdk-shared';

export type UseElementDataSourceProps = {
  id: string;
  bindings?: Record<string, ElementBinding[]>;
  filterMode?: UseDataSourceFilter;
};

const useElementDataSource = ({ id, bindings, filterMode }: UseElementDataSourceProps) => {
  const sourceFilter = useMemo(() => {
    const sources = new Set<string>();
    for (const bindingsGroup of Object.values(bindings ?? {})) {
      if (!Array.isArray(bindingsGroup)) {
        continue;
      }

      for (const { source } of bindingsGroup) {
        if (source) {
          sources.add(source);
        }
      }
    }

    sources.add('variables'); // no duplica si ya existe

    return [...sources];
  }, [bindings]);

  return useDataSource({ id, mode: 'read', sourceFilter, filterMode });
};

export default useElementDataSource;
