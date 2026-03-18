import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleItem, StyleValue, TagType } from '@plitzi/sdk-shared';

const addSelectorClassComponent = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: TagType,
  path: string | undefined,
  value: Extract<StyleItem, { type: 'class-component' }>['attributes'] | undefined | StyleValue,
  componentType: string
) => {
  const styleItem = getStyleItem(platform, displayMode, selector);
  if (styleItem || !componentType) {
    return false;
  }

  let attributes = {} satisfies Extract<StyleItem, { type: 'class-component' }>['attributes'];
  if (path) {
    set(attributes, path, value);
  } else if (!path && value) {
    attributes = value;
  }

  set(platform, `${displayMode}.${selector}`, {
    name: selector,
    type,
    attributes,
    componentType,
    cache: processSelector({ name: selector, type, attributes, componentType, cache: '' } as Extract<
      StyleItem,
      { type: 'class-component' }
    >)
  });

  return true;
};

export default addSelectorClassComponent;
