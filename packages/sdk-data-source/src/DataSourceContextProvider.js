// Packages
import React, { createContext, useCallback, useEffect, useMemo, useRef } from 'react';
import omit from 'lodash/omit';
import set from 'lodash/set';
import get from 'lodash/get';

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
      getSources: handleGetSources
    }),
    [useDataSource, handleAddSource, handleRemoveSource, handleGetSources, handleUpdateFields]
  );

  return <DataSourceContext value={valueMemo}>{children}</DataSourceContext>;
};

export default DataSourceContextProvider;
