import get from 'lodash/get.js';
import omit from 'lodash/omit.js';
import set from 'lodash/set.js';
import { createContext, useCallback, useEffect, useMemo, useRef } from 'react';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';

import NavigationSource from './sources/NavigationSource';
import PageStateSource from './sources/PageStateSource';
import UserSource from './sources/UserSource';
import VariablesSource from './sources/VariablesSource';

import type { DataSourceContextValue, Schema, Source, SourceMeta } from '@plitzi/sdk-shared';
import type { Context, ReactNode } from 'react';

export type DataSourceContextProviderProps = {
  children: ReactNode;
  environment?: 'local' | 'main' | 'production' | 'development' | 'staging';
};

const DataSourceContextProvider = ({ children, environment = 'main' }: DataSourceContextProviderProps) => {
  const sourcesRef = useRef<Record<string, Source>>({});
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
    }
  }, []);

  const handleAddSource = useCallback(
    <T = unknown,>(id: string, meta: SourceMeta = {} as SourceMeta) => {
      const existingSource = Object.values(sourcesRef.current).find(source => source.meta.source === meta.source);
      let context;
      if (existingSource) {
        ({ context } = existingSource);
      } else {
        context = createContext<T>(undefined as T);
      }

      sourcesRef.current[id] = { id, meta, context } as Source;

      return context as Context<T>;
    },
    [sourcesRef]
  );

  const handleUpdateFields = useCallback(
    (id: string, fields: SourceMeta['fields']) => set(sourcesRef.current, `${id}.meta.fields`, fields),
    [sourcesRef]
  );

  const handleGetSources = useCallback(
    (id?: string) => {
      if (id) {
        return get(sourcesRef.current, id) as Source | undefined;
      }

      return sourcesRef.current;
    },
    [sourcesRef]
  ) as DataSourceContextValue['getSources'];

  const handleGetSourcesByElementId = useCallback(
    (schemaFlat?: Schema['flat'], id?: string) => {
      if (!id || !schemaFlat) {
        return {};
      }

      const ids = FlatMap.parentTree(schemaFlat, id);
      const sources = Object.values(sourcesRef.current)
        .filter(source => ids.includes(source.meta.id) || source.meta.id === 'global')
        .reduce<Record<string, { id: string; meta: SourceMeta; context: Context<unknown> }>>(
          (acum, source) => ({ ...acum, [source.id]: source }),
          {}
        );

      return sources;
    },
    [sourcesRef]
  );

  const handleRemoveSource = useCallback(
    (id: string) => {
      sourcesRef.current = omit(sourcesRef.current, id);
    },
    [sourcesRef]
  );

  const valueMemo = useMemo(
    () => ({
      useDataSource,
      addSource: handleAddSource,
      updateFields: handleUpdateFields,
      removeSource: handleRemoveSource,
      getSources: handleGetSources,
      getSourcesByElementId: handleGetSourcesByElementId
    }),
    [handleAddSource, handleUpdateFields, handleRemoveSource, handleGetSources, handleGetSourcesByElementId]
  );

  return (
    <DataSourceContext value={valueMemo}>
      <UserSource>
        <VariablesSource environment={environment}>
          <NavigationSource>
            <PageStateSource>{children}</PageStateSource>
          </NavigationSource>
        </VariablesSource>
      </UserSource>
    </DataSourceContext>
  );
};

export default DataSourceContextProvider;
