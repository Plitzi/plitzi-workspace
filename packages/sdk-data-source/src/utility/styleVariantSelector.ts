import type { DataSourceUtility, DataSourceUtilityParamsValue } from '@plitzi/sdk-shared';

const callback = (_source: string, params: DataSourceUtilityParamsValue) => {
  const { variantSelector } = params;

  return variantSelector;
};

const styleSelector: DataSourceUtility = {
  action: 'styleVariantSelector',
  title: 'Style Variant Selector',
  type: 'utility',
  params: {
    variantSelector: {
      label: 'Variant Selector',
      defaultValue: '',
      type: 'select',
      options: []
    }
  },
  preview: { variantSelector: '' },
  callback
};

export default styleSelector;
