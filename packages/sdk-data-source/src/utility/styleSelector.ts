import type { DataSourceUtility, DataSourceUtilityParamsValue } from '@plitzi/sdk-shared';

const callback = (
  _source: string,
  params: DataSourceUtilityParamsValue,
  dataSources = {} as Record<string, string>
) => {
  const { append, selector } = params;
  if (append && dataSources.sourceTo) {
    return `${dataSources.sourceTo} ${selector}`;
  }

  return selector;
};

const styleSelector: DataSourceUtility = {
  action: 'styleSelector',
  title: 'Style Selector',
  type: 'utility',
  params: {
    append: {
      label: 'Append Selector',
      defaultValue: false,
      type: 'checkbox'
    },
    selector: {
      label: 'Selector',
      defaultValue: '',
      type: 'select',
      options: []
    }
  },
  preview: { append: '', selector: '' },
  callback
};

export default styleSelector;
