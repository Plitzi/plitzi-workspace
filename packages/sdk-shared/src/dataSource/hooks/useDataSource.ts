/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { use, useEffect, useMemo, useRef } from 'react';

import { emptyObject, makeId } from '../../helpers';
import DataSourceContext from '../DataSourceContext';

import type { SourceMeta } from '../../types';
import type { Context } from 'react';

export type UseDataSourceMode = 'write' | 'read';
export type UseDataSourceFilter = 'soft' | 'hard';

export type UseDataSourceProps<T extends UseDataSourceMode> = {
  id?: string;
  fields?: SourceMeta['fields'];
  mode: T;
  sourceFilter?: string[];
  filterMode?: UseDataSourceFilter;
} & (T extends 'read' ? { name?: string; source?: string } : { name: string; source: string });

// Overloads
function useDataSource<T = unknown>(props: UseDataSourceProps<'read'>): Record<string, T>;
function useDataSource<T = unknown>(props: UseDataSourceProps<'write'>): [Context<T>, string];
function useDataSource<T = unknown, M extends UseDataSourceMode = 'read'>({
  id = '',
  source,
  name,
  fields = [],
  mode = 'write' as M,
  sourceFilter = [],
  filterMode = 'soft'
}: UseDataSourceProps<M>): Record<string, T> | [Context<T>, string] {
  const { addSource, getSources, updateFields, removeSource } = use(DataSourceContext);
  const initRef = useRef(false);
  const uniqueId = useMemo(() => `${id}_${makeId(8)}`, [id]);
  const context = useRef<Context<T>>(undefined);
  const sourcesRef = useRef<Record<string, T>>({});
  if (mode === 'write' && (!name || !source)) {
    throw new Error('Name and Source are required in write mode');
  }

  if (mode === 'write' && !initRef.current) {
    initRef.current = true;
    context.current = addSource<T>(uniqueId, { id, source: source as string, name: name as string, fields });
  }

  useEffect(() => {
    if (mode === 'write' && !initRef.current) {
      initRef.current = true;
      context.current = addSource<T>(uniqueId, { id, source: source as string, name: name as string, fields });
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
    return [context.current as Context<T>, uniqueId];
  }

  if (filterMode === 'hard' && !sourceFilter.length) {
    return emptyObject;
  }

  let sources = Object.values(getSources());
  if (sourceFilter.length) {
    sources = sources.filter(
      source => !sourceFilter.length || !source.meta.source || sourceFilter.includes(source.meta.source)
    );
  }

  const sourcesData = sources
    .filter(source => source.meta.source)
    .map(source => ({ ...source, value: use(source.context) }))
    .reduce<Record<string, T>>((acum, source) => ({ ...acum, [source.meta.source as string]: source.value as T }), {});

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
