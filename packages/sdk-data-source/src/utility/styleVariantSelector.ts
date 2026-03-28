// import { get } from '@plitzi/plitzi-ui/helpers';

import type { DataSourceUtility, DataSourceUtilityParamsValue, Element } from '@plitzi/sdk-shared';

const callback = (
  _source: string,
  params: DataSourceUtilityParamsValue,
  _element: Partial<Element>,
  dataSources = {} as Record<string, unknown>
) => {
  const { variantSelector } = params;
  console.log(params, dataSources);

  // const w = useElement();

  return variantSelector;

  // const finalSelector: string[] = [];
  // if (append && !originalSelector && dataSources.sourceTo) {
  //   finalSelector.push(...[dataSources.sourceTo, selector as string]);
  // } else if (originalSelector && append) {
  //   const originalSelector = get(_element as Element, 'definition.styleSelectors.base', '');
  //   if (originalSelector) {
  //     finalSelector.push(...[originalSelector, selector as string]);
  //   } else {
  //     finalSelector.push(selector as string);
  //   }
  // }

  // if (!finalSelector.length) {
  //   return '';
  // }

  // if (finalSelector.length === 1) {
  //   return finalSelector[0];
  // }

  // return finalSelector.join(' ');
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
