import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';
import isValidValue from '../../helpers/isValueValid';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleState, StyleValue, TagType } from '@plitzi/sdk-shared';

const addSelectorDefault = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: Exclude<TagType, 'element'>,
  path: StyleCategory | undefined,
  value: Exclude<StyleItem, { type: 'element' }>['attributes'] | StyleValue | undefined,
  params: { state?: StyleState }
) => {
  if (
    !(params as typeof params | undefined) ||
    getStyleItem(platform, displayMode, selector) ||
    (path && path.includes('.')) ||
    !isValidValue(type, path, value, 1)
  ) {
    return false;
  }

  let attributes = {} satisfies Exclude<StyleItem, { type: 'element' }>['attributes'];
  if (path) {
    set(attributes, path, value);
  } else if (value) {
    attributes = value;
  }

  const { state } = params;
  const styleItem: StyleItem = { name: selector, type, attributes: {}, stateAttributes: {}, cache: '' };
  styleItem[state ? 'stateAttributes' : 'attributes'] = state ? { [state]: attributes } : attributes;
  styleItem.cache = processSelector(styleItem);
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default addSelectorDefault;
