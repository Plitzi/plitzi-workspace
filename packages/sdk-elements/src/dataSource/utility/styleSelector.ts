import { get } from '@plitzi/plitzi-ui/helpers';

import type { DataSourceUtility, DataSourceUtilityParamsValue, Element } from '@plitzi/sdk-shared';

const callback = (
  _source: string,
  params: DataSourceUtilityParamsValue,
  _element: Partial<Element>,
  dataSources = {} as Record<string, unknown>
) => {
  const { originalSelector, append, selector } = params;

  const finalSelector: string[] = [];
  if (append && !originalSelector && dataSources.sourceTo) {
    finalSelector.push(...[dataSources.sourceTo as string, selector as string]);
  } else if (originalSelector && append) {
    const originalSelector = get(_element as Element, 'definition.styleSelectors.base', '');
    if (originalSelector) {
      finalSelector.push(...[originalSelector, selector as string]);
    } else {
      finalSelector.push(selector as string);
    }
  }

  if (!finalSelector.length) {
    return '';
  }

  if (finalSelector.length === 1) {
    return finalSelector[0];
  }

  return finalSelector.join(' ');
};

const styleSelector: DataSourceUtility = {
  action: 'styleSelector',
  title: 'Style Selector',
  type: 'utility',
  params: {
    originalSelector: {
      label: 'Original Selector',
      description: 'This will append the original selector (require append option enabled)',
      defaultValue: false,
      disabled: ({ append }) => !append,
      type: 'checkbox'
    },
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
  preview: { append: '', originalSelector: '', selector: '' },
  callback
};

export default styleSelector;
