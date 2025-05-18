import { createContext } from 'react';

import type { Schema, Source, SourceMeta } from '../types';
import type useDataSource from './hooks/useDataSource';
import type { Context } from 'react';

export type DataSourceContextValue = {
  useDataSource: typeof useDataSource;
  addSource: <T = unknown>(id: string, meta?: SourceMeta) => Context<T>;
  updateFields: (id: string, fields: SourceMeta['fields']) => void;
  removeSource: (id: string) => void;
  getSources: (id?: string) => Record<string, Source> | Source | undefined;
  getSourcesByElementId: (schemaFlat?: Schema['flat'], id?: string) => Record<string, Source>;
};

const dataSourceContextDefaultValue = {} as DataSourceContextValue;

const DataSourceContext = createContext<DataSourceContextValue>(dataSourceContextDefaultValue);

export default DataSourceContext;
