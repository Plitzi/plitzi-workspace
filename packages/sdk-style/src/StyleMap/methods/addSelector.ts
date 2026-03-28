import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../helpers/processSelector';
import getStyleItem from '../helpers/getStyleItem';
import isValidValue, { isStyleAttributes } from '../helpers/isValueValid';
import { writeStyle } from '../helpers/utils';

import type {
  DisplayMode,
  Style,
  StyleAttributes,
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleStates,
  StyleValue,
  StyleVariants,
  TagType
} from '@plitzi/sdk-shared';

const addSelector = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: TagType,
  path: StyleCategory | undefined,
  value:
    | StyleItem['attributes']
    | StyleValue
    | Partial<StyleObject>
    | StyleVariants
    | StyleStates
    | StyleBlock
    | undefined,
  params: { componentType?: string; styleSelector?: string; styleState?: StyleState; styleVariant?: string }
): boolean => {
  if (!(params as typeof params | undefined)) {
    return false;
  }

  const { componentType, styleSelector, styleState, styleVariant } = params;
  if (
    getStyleItem(platform, displayMode, selector) ||
    (!componentType && type === 'element') ||
    (componentType && type !== 'element') ||
    (styleSelector && typeof styleSelector !== 'string') ||
    (!styleSelector && (styleState || styleVariant)) ||
    (path && path.includes('.')) ||
    !isValidValue(path, value, params)
  ) {
    return false;
  }

  const styleItem: StyleItem = {
    name: selector,
    type,
    attributes: styleSelector ? { [styleSelector]: { default: {} }, base: { default: {} } } : { base: { default: {} } },
    componentType,
    cache: ''
  };

  if (!styleSelector && isStyleAttributes(value as StyleAttributes)) {
    if (!value || !Object.keys(value).length) {
      value = { base: { default: {} } };
    }

    styleItem.attributes = value as StyleAttributes;
    styleItem.cache = processSelector(styleItem);
    set(platform, `${displayMode}.${selector}`, styleItem);

    return true;
  }

  writeStyle('add', styleItem, styleSelector ?? 'base', path, value, styleState, styleVariant);
  styleItem.cache = processSelector(styleItem);
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default addSelector;
