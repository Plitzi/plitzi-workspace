// Packages
import { createContext } from 'react';

// Types
import type useDataSource from './hooks/useDataSource';
import type { Schema } from '@plitzi/sdk-shared';
import type { Context } from 'react';

export type SourceField = { path: string; name: string };

export type SourceMeta = {
  id: string;
  name: string;
  source: string;
  fields?: SourceField[] | (() => SourceField[] | Promise<SourceField[]>);
};

export type Source<T = unknown> = { id: string; meta: SourceMeta; context: Context<T> };

export type DataSourceContextValue = {
  useDataSource: typeof useDataSource;
  addSource: <T = unknown>(id: string, meta?: SourceMeta) => Context<T>;
  updateFields: (id: string, fields: SourceMeta['fields']) => void;
  removeSource: (id: string) => void;
  getSources: (id?: string) => Record<string, Source> | Source;
  getSourcesByElementId: (schemaFlat?: Schema['flat'], id?: string) => Record<string, Source>;
};

const dataSourceContextDefaultValue = {} as DataSourceContextValue;

const DataSourceContext = createContext<DataSourceContextValue>(dataSourceContextDefaultValue);

export default DataSourceContext;
