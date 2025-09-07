import type { Schema } from './SchemaTypes';
import type useDataSource from '../dataSource/hooks/useDataSource';
import type { Field, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Context } from 'react';

export type DataSourceUtilityParams<TParams = string | boolean | number> = Record<
  string,
  {
    type?: DataSourceUtilityParamType | ((params: DataSourceUtilityParamsValue<TParams>) => DataSourceUtilityParamType);
    label?: string;
    defaultValue?: string | boolean | number;
    options?: { label: string; value: string }[];
  }
>;

export type DataSourceUtilityParamsValue<T = string | boolean | number> = Record<
  keyof DataSourceUtility<T>['params'],
  T
>;

export type DataSourceUtilityParamType = 'text' | 'select' | 'textarea' | 'checkbox' | 'codemirror-text';

export type DataSourceUtility<
  TSource = string,
  TSourceReturn = string | boolean | number,
  TParams = string | boolean | number
> = {
  action: string;
  title: string;
  type: 'utility' | 'unknown';
  params: DataSourceUtilityParams<TParams>;
  preview: Record<string, string>;
  callback: (
    source: TSource,
    params: DataSourceUtilityParamsValue<TParams>,
    dataSources?: Record<string, string>
  ) => TSourceReturn;
};

export type SourceField = {
  path: string;
  name: string;
  inputType?: Field['inputType'];
  values?: { value: RuleValue; label: 'string' }[];
};

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
  getSources: {
    (id: string): Source | undefined;
    (): Record<string, Source>;
  };
  getSourcesByElementId: (schemaFlat?: Schema['flat'], id?: string) => Record<string, Source>;
};
