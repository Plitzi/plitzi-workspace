import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleValue, TagType } from '@plitzi/sdk-shared';

const addSelectorDefault = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: TagType,
  path?: StyleCategory,
  value?: Exclude<StyleItem, { type: 'class-component' }>['attributes'] | StyleValue
) => {
  const styleItem = getStyleItem(platform, displayMode, selector);
  if (styleItem || (path && path.includes('.')) || (path && typeof value === 'object')) {
    return false;
  }

  let attributes = {} satisfies Exclude<StyleItem, { type: 'class-component' }>['attributes'];
  if (path) {
    set(attributes, path, value);
  } else if (value) {
    attributes = value;
  }

  set(platform, `${displayMode}.${selector}`, {
    name: selector,
    type,
    attributes,
    cache: processSelector({ name: selector, type, attributes, cache: '' } as Exclude<
      StyleItem,
      { type: 'class-component' }
    >)
  });

  return true;
};

export default addSelectorDefault;
