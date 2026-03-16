import { set } from '@plitzi/plitzi-ui/helpers/lodash';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleItem, TagType } from '@plitzi/sdk-shared';

const addSelectorClassComponent = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: TagType,
  path: string,
  value: Extract<StyleItem, { type: 'class-component' }>['attributes'] | undefined,
  componentType: string
) => {
  const styleItem = getStyleItem(platform, displayMode, selector);
  if (styleItem || !componentType) {
    return false;
  }

  let attributes = {} as Extract<StyleItem, { type: 'class-component' }>['attributes'];
  if (path) {
    set(attributes, path, value);
  } else if (!path && value) {
    attributes = value;
  }

  set(platform, `${displayMode}.${selector}`, {
    name: selector,
    type,
    attributes,
    cache: processSelector({ name: selector, type, attributes })
  });

  return true;
};

export default addSelectorClassComponent;
