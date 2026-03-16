import type { StyleItem } from '@plitzi/sdk-shared';

const processSelectorName = (selector: Omit<StyleItem, 'cache'>) => {
  const { name, type } = selector;
  let finalSelector = name;
  switch (type) {
    case 'class':
    case 'class-component':
    case 'state':
      finalSelector = `.${name}`;
      break;

    case 'id':
      finalSelector = `#${name}`;
      break;

    case 'element':
    case 'parent':
    default:
  }

  return finalSelector;
};

export default processSelectorName;
