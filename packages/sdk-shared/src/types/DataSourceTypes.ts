import type { Schema } from './SchemaTypes';
import type { Context } from 'react';

export type SourceField = { path: string; name: string };

export type SourceMeta = {
  id: string;
  name: string;
  source: string;
  fields?: SourceField[] | (() => SourceField[] | Promise<SourceField[]>);
};

export type Source<T = unknown> = { id: string; meta: SourceMeta; context: Context<T> };

export type UseDataSourceMode = 'write' | 'read';
export type UseDataSourceFilter = 'soft' | 'hard';

export type UseDataSourceProps<T extends UseDataSourceMode> = {
  id: string;
  fields?: SourceMeta['fields'];
  mode: T;
  sourceFilter?: string[];
  filterMode?: UseDataSourceFilter;
} & (T extends 'read' ? { name?: string; source?: string } : { name: string; source: string });

export type DataSourceContextValue<T = unknown> = {
  useDataSource: T;
  addSource: <T = unknown>(id: string, meta?: SourceMeta) => Context<T>;
  updateFields: (id: string, fields: SourceMeta['fields']) => void;
  removeSource: (id: string) => void;
  getSources: (id?: string) => Record<string, Source> | Source | undefined;
  getSourcesByElementId: (schemaFlat?: Schema['flat'], id?: string) => Record<string, Source>;
};
