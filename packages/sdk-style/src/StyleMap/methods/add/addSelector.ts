import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';
import isValidValue, { isStyleAttributes, isStyleObject } from '../../helpers/isValueValid';
import omitUndefined from '../../helpers/omitUndefined';

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
    (styleState && styleVariant) ||
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
    styleItem.attributes = value as StyleAttributes;
    styleItem.cache = processSelector(styleItem);
    set(platform, `${displayMode}.${selector}`, styleItem);

    return true;
  }

  const attrBlock = styleItem.attributes[styleSelector ? styleSelector : 'base'];
  if (styleVariant) {
    if (!attrBlock.variants) {
      attrBlock.variants = {};
    }

    if (!(attrBlock.variants[styleVariant] as StyleVariants[string] | undefined)) {
      attrBlock.variants[styleVariant] = { default: {}, states: {} };
    }

    if (attrBlock.variants[styleVariant].default) {
      if (path && (typeof value === 'string' || typeof value === 'number')) {
        attrBlock.variants[styleVariant].default[path] = value as StyleValue;
      } else if (value && isStyleObject(value as StyleObject)) {
        Object.assign(attrBlock.variants[styleVariant].default, omitUndefined(value as StyleObject));
      }
    }
  } else if (styleState) {
    if (!attrBlock.states) {
      attrBlock.states = {};
    }

    if (!attrBlock.states[styleState]) {
      attrBlock.states[styleState] = {};
    }

    if (path && (typeof value === 'string' || typeof value === 'number')) {
      attrBlock.states[styleState][path] = value as StyleValue;
    } else if (value && isStyleObject(value as StyleObject)) {
      Object.assign(attrBlock.states[styleState], omitUndefined(value as StyleObject));
    }
  } else {
    if (!attrBlock.default) {
      attrBlock.default = {};
    }

    if (path && (typeof value === 'string' || typeof value === 'number')) {
      attrBlock.default[path] = value as StyleValue;
    } else if (value && isStyleObject(value as StyleObject)) {
      Object.assign(attrBlock.default, omitUndefined(value as StyleObject));
    }
  }

  styleItem.cache = processSelector(styleItem);
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default addSelector;
