import { get, omit, set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';
import isValidValue from '../../helpers/isValueValid';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleState, StyleValue } from '@plitzi/sdk-shared';

const updateSelectorDefault = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  path: StyleCategory | undefined,
  value: Exclude<StyleItem, { type: 'element' }>['attributes'] | StyleValue | undefined,
  params: { styleState?: StyleState }
) => {
  const styleItem = getStyleItem(platform, displayMode, selector);
  if (
    !(params as typeof params | undefined) ||
    !styleItem ||
    (path && path.includes('.')) ||
    !isValidValue(styleItem.type, path, value, 1)
  ) {
    return false;
  }

  const { styleState } = params;
  const basePath = styleState ? `stateAttributes.${styleState}` : 'attributes';
  if (value === undefined) {
    if (path) {
      const current = get(styleItem, basePath, {});
      set(styleItem, basePath, omit(current, [path]));
    } else {
      set(styleItem, basePath, {});
    }
  } else if (path) {
    set(styleItem, `${basePath}.${path}`, value);
  } else {
    set(styleItem, basePath, value);
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelectorDefault;
