// Packages
import { use, useEffect, useMemo, useRef } from 'react';

// Monorepo
import { makeId } from '@plitzi/sdk-shared/utils';

// Relatives
import DataSourceContext from '../DataSourceContext';

export const MODE_WRITE = 'write';
export const MODE_READ = 'read';

/**
 * @param {{
 *   id: string;
 *   source: string;
 *   name: string;
 *   fields: object[];
 *   value: object;
 *   mode: 'write' | 'read';
 *   extraElements: object[];
 * }} props
 * @returns {object}
 */
const useDataSource = (props = {}) => {
  const { id, source, name, fields = [], mode = MODE_WRITE } = props;
  const { addSource, getSources, updateFields, removeSource } = use(DataSourceContext);
  const initRef = useRef();
  const uniqueId = useMemo(() => `${id}_${makeId(8)}`, [id]);
  const context = useRef(undefined);
  if (mode === MODE_WRITE && !initRef.current) {
    initRef.current = true;
    context.current = addSource(uniqueId, { id, source, name, fields });
  }

  useEffect(() => {
    if (mode === MODE_WRITE && !initRef.current) {
      initRef.current = true;
      context.current = addSource(uniqueId, { id, source, name, fields });
    }

    return () => {
      initRef.current = false;
      removeSource(uniqueId);
    };
  }, [uniqueId]);

  useEffect(() => {
    if (mode === MODE_WRITE) {
      updateFields(uniqueId, fields);
    }
  }, [fields, uniqueId, updateFields]);

  if (mode === MODE_WRITE) {
    return [context.current, uniqueId];
  }

  return Object.values(getSources()).reduce(
    (acum, { meta, context }) => ({ ...acum, [meta.source]: use(context) }),
    {}
  );
};

export default useDataSource;
