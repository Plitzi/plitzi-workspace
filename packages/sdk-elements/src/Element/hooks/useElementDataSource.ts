import { useMemo } from 'react';

import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';

import type { ElementBinding, UseDataSourceFilter } from '@plitzi/sdk-shared';

export type UseElementDataSourceProps = {
  id: string;
  bindings?: Record<string, ElementBinding[]>;
  filterMode?: UseDataSourceFilter;
  sources?: string[];
};

const useElementDataSource = ({ id, bindings, sources: sourcesProp, filterMode }: UseElementDataSourceProps) => {
  const sourceFilter = useMemo(() => {
    const sources = new Set<string>(sourcesProp ?? []);
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

    return [...sources];
  }, [bindings, sourcesProp]);

  return useDataSource({ id, mode: 'read', sourceFilter, filterMode });
};

export default useElementDataSource;
