// Packages
import React, { createContext, useCallback, useEffect, useMemo, useRef } from 'react';
import omit from 'lodash/omit';
import set from 'lodash/set';
import get from 'lodash/get';

// Monorepo
import FlatMap from '@plitzi/sdk-schema/FlatMap';

// Relatives
import DataSourceContext from './DataSourceContext';
import useDataSource from './hooks/useDataSource';
import UserSource from './sources/UserSource';
import VariablesSource from './sources/VariablesSource';
import NavigationSource from './sources/NavigationSource';
import PageStateSource from './sources/PageStateSource';

/**
 * @param {{
 *   children: React.ReactNode;
 *   environment: string;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceContextProvider = props => {
  const { children, environment } = props;
  const sourcesRef = useRef({});
  const initRef = useRef();

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
    }
  }, []);

  const handleAddSource = useCallback(
    (id, meta = {}) => {
      const existingSource = Object.values(sourcesRef.current).find(source => source.meta.source === meta.source);
      let context;
      if (existingSource) {
        ({ context } = existingSource);
      } else {
        context = createContext();
      }

      sourcesRef.current[id] = { id, meta, context };

      return context;
    },
    [sourcesRef]
  );

  const handleUpdateFields = useCallback(
    (id, fields) => set(sourcesRef.current, `${id}.meta.fields`, fields),
    [sourcesRef]
  );

  const handleGetSources = useCallback(
    id => {
      if (id) {
        return get(sourcesRef.current, id);
      }

      return sourcesRef.current;
    },
    [sourcesRef]
  );

  const handleGetSourcesByElementId = useCallback(
    (schemaFlat, id) => {
      if (!id || !schemaFlat) {
        return {};
      }

      const ids = FlatMap.getParentTree(schemaFlat, id);
      const sources = Object.values(sourcesRef.current)
        .filter(source => ids.includes(source.meta.id) || source.meta.id === 'global')
        .reduce((acum, source) => ({ ...acum, [source.id]: source }), {});

      return sources;
    },
    [sourcesRef]
  );

  const handleRemoveSource = useCallback(
    id => {
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
    [useDataSource, handleAddSource, handleRemoveSource, handleGetSources, handleUpdateFields]
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
