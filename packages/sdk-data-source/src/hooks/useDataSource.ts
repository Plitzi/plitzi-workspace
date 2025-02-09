/* eslint-disable @typescript-eslint/no-dynamic-delete */
// Packages
import { use, useEffect, useMemo, useRef } from 'react';

// Monorepo
import { makeId, emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import DataSourceContext from '../DataSourceContext';

// Types
import type { Source, SourceMeta } from '../DataSourceContext';
import type { Context } from 'react';

export const MODE_WRITE = 'write';
export const MODE_READ = 'read';

export const FILTER_MODE_SOFT = 'soft';
export const FILTER_MODE_HARD = 'hard';

export type UseDataSourceMode = 'write' | 'read';
export type UseDataSourceFilter = 'soft' | 'hard';

export type UseDataSourceProps<T extends UseDataSourceMode> = {
  id: string;
  source: string;
  name: string;
  fields?: SourceMeta['fields'];
  mode: T;
  sourceFilter?: string[];
  filterMode?: UseDataSourceFilter;
};

// Overloads
function useDataSource(props: UseDataSourceProps<'read'>): Record<string, unknown>;
function useDataSource(props: UseDataSourceProps<'write'>): [Context<unknown>, string];
function useDataSource<T extends UseDataSourceMode>({
  id,
  source,
  name,
  fields = [],
  mode = 'write' as T,
  sourceFilter = [],
  filterMode = 'soft'
}: UseDataSourceProps<T>): Record<string, unknown> | [Context<unknown>, string] {
  const { addSource, getSources, updateFields, removeSource } = use(DataSourceContext);
  const initRef = useRef(false);
  const uniqueId = useMemo(() => `${id}_${makeId(8)}`, [id]);
  const context = useRef<Context<unknown>>(undefined);
  const sourcesRef = useRef<Record<string, unknown>>({});
  if (mode === 'write' && !initRef.current) {
    initRef.current = true;
    context.current = addSource(uniqueId, { id, source, name, fields });
  }

  useEffect(() => {
    if (mode === 'write' && !initRef.current) {
      initRef.current = true;
      context.current = addSource(uniqueId, { id, source, name, fields });
    }

    return () => {
      initRef.current = false;
      removeSource(uniqueId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueId]);

  useEffect(() => {
    if (mode === 'write') {
      updateFields(uniqueId, fields);
    }
  }, [fields, uniqueId, updateFields, mode]);

  if (mode === 'write') {
    return [context.current as Context<unknown>, uniqueId];
  }

  if (filterMode === 'hard' && !sourceFilter.length) {
    return emptyObject;
  }

  let sources = Object.values(getSources() as Record<string, Source>);
  if (sourceFilter.length) {
    sources = sources.filter(source => !sourceFilter.length || sourceFilter.includes(source.meta.source));
  }

  const sourcesData = sources
    .map(source => ({ ...source, value: use(source.context) }))
    .reduce<Record<string, unknown>>((acum, source) => ({ ...acum, [source.meta.source]: source.value }), {});

  const shouldReRender =
    Object.entries(sourcesRef.current).filter(([source, value]) => value !== sourcesData[source]).length > 0 ||
    Object.keys(sourcesData).length !== Object.keys(sourcesRef.current).length;

  if (shouldReRender) {
    sourcesRef.current = sourcesData;
  } else {
    // To prevent re-rendering we will keep the same object and just override the sources internally
    Object.keys(sourcesRef.current).forEach(source => {
      delete sourcesRef.current[source];
    });
    Object.entries(sourcesData).forEach(([source, value]) => {
      sourcesRef.current[source] = value;
    });
  }

  return sourcesRef.current;
}

export default useDataSource;
