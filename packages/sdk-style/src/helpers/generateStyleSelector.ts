import processSelector from './processSelector';

import type { StyleItem, TagType } from '@plitzi/sdk-shared';

const generateStyleSelector = (
  selector = '',
  selectorType: TagType = 'class',
  values: StyleItem['attributes'] = {}
) => {
  if (!selector || typeof values !== 'object') {
    return undefined;
  }

  return {
    name: selector,
    type: selectorType,
    attributes: values,
    cache: processSelector(selector, selectorType, values)
  };
};

export default generateStyleSelector;
