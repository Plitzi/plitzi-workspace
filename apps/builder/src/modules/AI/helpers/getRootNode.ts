import { generateID } from '@plitzi/sdk-shared/helpers/utils';
import generateStyleSelector from '@plitzi/sdk-style/helpers/generateStyleSelector';

import type { Element, StyleItem } from '@plitzi/sdk-shared';

const getRootNode = (parentNode?: Element, params = { centered: false }) => {
  const id = generateID();

  const rootNode: Element = {
    id,
    attributes: { subtype: 'div' },
    definition: {
      label: 'Container',
      type: 'container',
      items: [],
      bindings: {},
      rootId: id,
      parentId: parentNode?.id ?? '',
      styleSelectors: { base: 'root-container' }
    }
  };
  const attributes: StyleItem['attributes'] = {
    base: {
      default: {
        display: 'flex',
        overflow: 'auto',
        'flex-direction': 'column',
        'min-height': '100%',
        'min-width': '100%',
        'max-width': '100%',
        'padding-top': '4px',
        'padding-bottom': '4px',
        'padding-left': '4px',
        'padding-right': '4px'
      }
    }
  };

  if (params.centered && attributes.base.default) {
    attributes.base.default['justify-content'] = 'center';
    attributes.base.default['align-items'] = 'center';
  }

  return {
    rootNode,
    rootStyleSelector: 'root-container',
    rootStyle: generateStyleSelector('root-container', 'class', attributes, {}) as StyleItem
  };
};

export default getRootNode;
