import type { DataSourceUtility, DataSourceUtilityParamsValue } from '../../types';

const callback = (source: string, params: DataSourceUtilityParamsValue<string>) => {
  const { separator } = params;

  return typeof source === 'string' ? source.split(separator).map(v => v.trim()) : source;
};

const stringToArray: DataSourceUtility<string, string[], string> = {
  action: 'stringToArray',
  title: 'Text to List',
  type: 'utility',
  params: {
    separator: {
      label: 'Separator',
      defaultValue: ',',
      type: 'text'
    }
  },
  preview: { valueType: '', value: '' },
  callback
};

export default stringToArray;
