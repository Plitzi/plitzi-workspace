import type { DataSourceUtility, DataSourceUtilityParamsValue } from '@plitzi/sdk-shared';

const callback = (source: string, params: DataSourceUtilityParamsValue<string>) => {
  const { separator } = params;

  console.log(source, params);

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
      // options: [
      //   { label: 'Text', value: 'text' },
      //   { label: 'Long Text', value: 'textarea' },
      //   { label: 'Boolean', value: 'select' }
      // ]
    }
    // value: {
    //   defaultValue: '',
    //   type: ({ valueType }) => valueType as DataSourceUtilityParamType,
    //   options: [
    //     { label: 'True', value: 'true' },
    //     { label: 'False', value: 'false' }
    //   ]
    // }
  },
  preview: { valueType: '', value: '' },
  callback
};

export default stringToArray;
