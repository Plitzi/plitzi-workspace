import { omit, set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';

const updateSelectorClassComponent = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  path: StyleCategory | undefined,
  value: Extract<StyleItem, { type: 'element' }>['attributes'] | StyleValue | undefined,
  params: { componentType: string; styleSelector?: string }
) => {
  const styleItem = getStyleItem(platform, displayMode, selector) as
    | Extract<StyleItem, { type: 'element' }>
    | undefined;
  if (!styleItem || !(params as typeof params | undefined) || !params.componentType) {
    return false;
  }

  const { styleSelector } = params;
  if (path && styleSelector && value) {
    set(styleItem, `attributes.${styleSelector}.${path}`, value);
  } else if (path && styleSelector) {
    set(styleItem, `attributes.${styleSelector}`, omit(styleItem.attributes[styleSelector], [path]));
  } else if (!path && value) {
    set(styleItem, 'attributes', value);
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelectorClassComponent;
