import processSelector from './processSelector';

import type { StyleItem, TagType } from '@plitzi/sdk-shared';

const generateStyleSelector = (
  selector = '',
  selectorType: TagType = 'class',
  values: StyleItem['attributes'] = {},
  variables: StyleItem['variables']
) => {
  if (!selector || typeof values !== 'object') {
    return undefined;
  }

  return {
    name: selector,
    type: selectorType,
    attributes: values,
    variables,
    cache: processSelector({ name: selector, type: selectorType, attributes: values, variables, cache: '' })
  };
};

export default generateStyleSelector;
