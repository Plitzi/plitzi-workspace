import type { DataSourceUtility, DataSourceUtilityParamsValue, DataSourceUtilityParamType } from '@plitzi/sdk-shared';

const callback = (_source: string, params: DataSourceUtilityParamsValue) => {
  const { valueType, value } = params;
  if (valueType === 'select') {
    return value === 'true';
  }

  return value;
};

const staticValue: DataSourceUtility = {
  action: 'staticValue',
  title: 'Static Value',
  type: 'utility',
  params: {
    valueType: {
      label: 'Value Type',
      defaultValue: 'text',
      type: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Long Text', value: 'textarea' },
        { label: 'Boolean', value: 'select' }
      ]
    },
    value: {
      defaultValue: '',
      type: ({ valueType }) => valueType as DataSourceUtilityParamType,
      options: [
        { label: 'True', value: 'true' },
        { label: 'False', value: 'false' }
      ]
    }
  },
  preview: { valueType: '', value: '' },
  callback
} as const;

export default staticValue;
