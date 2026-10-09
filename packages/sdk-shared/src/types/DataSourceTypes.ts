import type { Element } from './SchemaTypes';
import type { Field, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

export type DataSourceUtilityParamsOption =
  { label: string; value: string } | { label: string; options: { label: string; value: string }[] };

export type DataSourceUtilityParams<TParams = string | boolean | number> = Record<
  string,
  {
    type?: DataSourceUtilityParamType | ((params: DataSourceUtilityParamsValue<TParams>) => DataSourceUtilityParamType);
    label?: string;
    description?: string;
    defaultValue?: string | boolean | number;
    disabled?: boolean | ((params: DataSourceUtilityParamsValue<TParams>) => boolean);
    options?:
      | DataSourceUtilityParamsOption[]
      | Promise<DataSourceUtilityParamsOption[]>
      | ((
          params: DataSourceUtilityParamsValue<TParams>,
          element?: Partial<Element>,
          data?: Record<string, unknown>
        ) => DataSourceUtilityParamsOption[] | Promise<DataSourceUtilityParamsOption[]>);
  }
>;

export type DataSourceUtilityParamsValue<T = string | boolean | number> = Record<
  keyof DataSourceUtility<T>['params'],
  T
>;

export type DataSourceUtilityParamType = 'text' | 'select' | 'textarea' | 'checkbox' | 'codemirror-text';

/**
 * A step a binding's value goes through on its way to an attribute. It receives whatever the binding resolved to — or
 * the step before it answered — and a value it has no use for goes on untouched, so both ends are `unknown` unless one
 * says more.
 */
export type DataSourceUtility<TSource = unknown, TSourceReturn = unknown, TParams = string | boolean | number> = {
  action: string;
  title: string;
  type: 'utility' | 'unknown';
  params: DataSourceUtilityParams<TParams>;
  preview: Record<string, string>;
  callback: (
    source: TSource,
    params: DataSourceUtilityParamsValue<TParams>,
    element: Partial<Element>,
    dataSources?: Record<string, unknown>
  ) => TSourceReturn;
};

export type SourceField = {
  path: string;
  name: string;
  inputType?: Field['inputType'];
  values?: { value: RuleValue; label: 'string' }[];
};

export type SourceMeta = {
  id?: string;
  name: string;
  source?: string;
  fields?: SourceField[] | (() => SourceField[] | Promise<SourceField[]>);
};

export type Source = { id: string; meta: SourceMeta };
