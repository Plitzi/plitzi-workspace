// Packages
import { use, useEffect, useMemo, useRef } from 'react';

// Monorepo
import { makeId, emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import DataSourceContext from '../DataSourceContext';

export const MODE_WRITE = 'write';
export const MODE_READ = 'read';

export const FILTER_MODE_SOFT = 'soft';
export const FILTER_MODE_HARD = 'hard';

/**
 * @param {{
 *   id: string;
 *   source: string;
 *   name: string;
 *   fields: object[];
 *   value: object;
 *   mode: 'write' | 'read';
 *   extraElements: object[];
 *   sourceFilter?: string[];
 *   filterMode?: 'soft' | 'hard';
 * }} props
 * @returns {object}
 */
const useDataSource = (props = {}) => {
  const { id, source, name, fields = [], mode = MODE_WRITE, sourceFilter = [], filterMode = FILTER_MODE_SOFT } = props;
  const { addSource, getSources, updateFields, removeSource } = use(DataSourceContext);
  const initRef = useRef();
  const uniqueId = useMemo(() => `${id}_${makeId(8)}`, [id]);
  const context = useRef(undefined);
  const sourcesRef = useRef({});
  if (mode === MODE_WRITE && !initRef.current && addSource) {
    initRef.current = true;
    context.current = addSource(uniqueId, { id, source, name, fields });
  }

  useEffect(() => {
    if (mode === MODE_WRITE && !initRef.current && addSource) {
      initRef.current = true;
      context.current = addSource(uniqueId, { id, source, name, fields });
    }

    return () => {
      initRef.current = false;
      if (removeSource) {
        removeSource(uniqueId);
      }
    };
  }, [uniqueId]);

  useEffect(() => {
    if (mode === MODE_WRITE && updateFields) {
      updateFields(uniqueId, fields);
    }
  }, [fields, uniqueId, updateFields]);

  if (mode === MODE_WRITE) {
    return [context.current, uniqueId];
  }

  if ((filterMode === FILTER_MODE_HARD && !sourceFilter.length) || !getSources) {
    return emptyObject;
  }

  let sources = Object.values(getSources());
  if (sourceFilter.length) {
    sources = sources.filter(source => !sourceFilter?.length || sourceFilter.includes(source.meta.source));
  }

  // To prevent re-rendering we will keep the same object and just override the sources internally
  Object.keys(sourcesRef.current).forEach(source => {
    delete sourcesRef.current[source];
  });
  sources.forEach(({ meta, context }) => {
    sourcesRef.current[meta.source] = use(context);
  });

  return sourcesRef.current;
};

export default useDataSource;
