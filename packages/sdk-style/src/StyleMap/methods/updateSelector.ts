import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../helpers/processSelector';
import getStyleItem from '../helpers/getStyleItem';
import isValidValue from '../helpers/isValueValid';
import { writeStyle } from '../helpers/utils';

import type {
  DisplayMode,
  Style,
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleStates,
  StyleValue,
  StyleVariants
} from '@plitzi/sdk-shared';

const updateSelector = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  path: StyleCategory | undefined,
  value:
    | StyleItem['attributes']
    | StyleValue
    | Partial<StyleObject>
    | StyleVariants
    | StyleStates
    | StyleBlock
    | undefined,
  params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string }
) => {
  if (!(params as typeof params | undefined)) {
    return false;
  }

  const { componentType, styleSelector, styleState, styleVariant } = params;
  const styleItem = getStyleItem(platform, displayMode, selector);

  if (
    !styleItem ||
    !styleSelector ||
    (!componentType && styleItem.type === 'element') ||
    (componentType && styleItem.type !== 'element') ||
    (styleSelector && typeof styleSelector !== 'string') ||
    (path && path.includes('.')) ||
    !isValidValue(path, value, params)
  ) {
    return false;
  }

  writeStyle('update', styleItem, styleSelector, path, value, styleState, styleVariant);
  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelector;
