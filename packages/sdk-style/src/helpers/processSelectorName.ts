import type { StyleItem } from '@plitzi/sdk-shared';

const processSelectorName = (selector: Omit<StyleItem, 'cache'>) => {
  const { name, type } = selector;
  let finalSelector = name;
  switch (type) {
    case 'element':
      finalSelector = `.plitzi__${name}`;
      break;

    case 'class':
      finalSelector = `.${name}`;
      break;

    case 'id':
      finalSelector = `#${name}`;
      break;

    default:
  }

  return finalSelector;
};

export default processSelectorName;
