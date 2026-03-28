import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../helpers/processSelector';
import getStyleItem from '../helpers/getStyleItem';
import isValidValue, { isStyleAttributes } from '../helpers/isValueValid';
import { parseValue } from '../helpers/utils';

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
    if (!value) {
      value = { base: { default: {} } };
    }

    styleItem.attributes = value as StyleAttributes;
    styleItem.cache = processSelector(styleItem);
    set(platform, `${displayMode}.${selector}`, styleItem);

    return true;
  }

  const attrBlock = styleItem.attributes[styleSelector ? styleSelector : 'base'];

  if (styleVariant) {
    attrBlock.variants ??= {};
    const variant = (attrBlock.variants[styleVariant] ??= { default: {}, states: {} });
    if (styleState) {
      variant.states ??= {};
      variant.states[styleState] ??= {};

      variant.states[styleState] = parseValue(path, value, variant.states[styleState]);
    } else {
      variant.default ??= {};
      variant.default = parseValue(path, value, variant.default);
    }
  } else if (styleState) {
    attrBlock.states ??= {};
    attrBlock.states[styleState] ??= {};
    attrBlock.states[styleState] = parseValue(path, value, attrBlock.states[styleState]);
  } else {
    attrBlock.default ??= {};

    attrBlock.default = parseValue(path, value, attrBlock.default);
  }

  styleItem.cache = processSelector(styleItem);
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default addSelector;
