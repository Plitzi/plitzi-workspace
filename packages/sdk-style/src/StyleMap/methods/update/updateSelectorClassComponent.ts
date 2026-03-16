import { omit, set } from '@plitzi/plitzi-ui/helpers/lodash';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleItem } from '@plitzi/sdk-shared';

const updateSelectorClassComponent = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  path: string,
  value: Extract<StyleItem, { type: 'class-component' }>['attributes'] | undefined
) => {
  const styleItem = getStyleItem(platform, displayMode, selector);
  if (!styleItem) {
    return false;
  }

  if (path && value) {
    set(styleItem, `attributes.${path}`, value);
  } else if (path) {
    set(styleItem, 'attributes', omit(styleItem.attributes, [path]));
  } else if (!path && value) {
    set(styleItem, 'attributes', value);
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelectorClassComponent;
