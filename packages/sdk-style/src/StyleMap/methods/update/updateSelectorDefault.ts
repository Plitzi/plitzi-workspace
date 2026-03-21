import { omit, set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';

const updateSelectorDefault = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  path?: StyleCategory,
  value?: Exclude<StyleItem, { type: 'class-component' }>['attributes'] | StyleValue
) => {
  const styleItem = getStyleItem(platform, displayMode, selector);
  if (!styleItem || (path && path.includes('.'))) {
    return false;
  }

  if (path && value) {
    set(styleItem, `attributes.${path}`, value);
  } else if (path) {
    set(styleItem, 'attributes', omit(styleItem.attributes, [path]));
  } else if (value) {
    set(styleItem, 'attributes', value);
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelectorDefault;
