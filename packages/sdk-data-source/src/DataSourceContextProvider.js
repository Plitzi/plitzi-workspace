// Packages
import React, { createContext, useCallback, useMemo, useRef } from 'react';
import omit from 'lodash/omit';

// Relatives
import DataSourceContext from './DataSourceContext';
import useDataSource from './hooks/useDataSource';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceContextProvider = props => {
  const { children } = props;
  const sourcesRef = useRef({});
  const handleAddSource = useCallback((id, meta = {}) => {
    const existingSource = Object.values(sourcesRef.current).find(source => source.meta.source === meta.source);
    let context;
    if (existingSource) {
      ({ context } = existingSource);
    } else {
      context = createContext();
    }

    sourcesRef.current[id] = { id, meta, context };

    return context;
  }, []);

  const handleGetSources = useCallback(
    id => {
      if (id) {
        return sourcesRef.current[id];
      }

      return sourcesRef.current;
    },
    [sourcesRef]
  );

  const handleRemoveSource = useCallback(id => {
    sourcesRef.current = omit(sourcesRef.current, id);
  }, []);

  const valueMemo = useMemo(
    () => ({
      useDataSource,
      addSource: handleAddSource,
      removeSource: handleRemoveSource,
      getSources: handleGetSources
    }),
    [useDataSource, handleAddSource, handleRemoveSource, handleGetSources]
  );

  return <DataSourceContext value={valueMemo}>{children}</DataSourceContext>;
};

export default DataSourceContextProvider;
