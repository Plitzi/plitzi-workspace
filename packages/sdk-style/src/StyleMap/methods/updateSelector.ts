import { omit, set, get } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../helpers/processSelector';
import getStyleItem from '../helpers/getStyleItem';
import isValidValue, { isStyleObject } from '../helpers/isValueValid';
import { getTargetPath, isEmptyObject, applyValue } from '../helpers/utils';

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

  if (value !== undefined) {
    const targetPath = getTargetPath(styleSelector, styleVariant, styleState);
    if (isStyleObject(value as Partial<StyleObject>) && isEmptyObject(value)) {
      if (!styleState && !styleVariant) {
        // reset default only
        set(styleItem, targetPath, {});
      }
      // do nothing for state/variant
    } else {
      const target = get(styleItem, targetPath, {});
      applyValue(path, value, target);
      set(styleItem, targetPath, target);
    }
  } else if (path) {
    const targetPath = getTargetPath(styleSelector, styleVariant, styleState);
    const current = get(styleItem, targetPath, {});
    set(styleItem, targetPath, omit(current, [path]));
  } else if (styleVariant) {
    const variantsPath = `attributes.${styleSelector}.variants`;
    const fragment = get(styleItem, variantsPath) as StyleVariants | undefined;
    if (fragment) {
      const next = omit(fragment, [styleVariant]);
      if (Object.keys(next).length) {
        set(styleItem, variantsPath, next);
      } else {
        set(
          styleItem,
          `attributes.${styleSelector}`,
          omit(get(styleItem, `attributes.${styleSelector}`), ['variants'])
        );
      }
    }
  } else if (styleState) {
    const statesPath = `attributes.${styleSelector}.states`;
    const fragment = get(styleItem, statesPath) as StyleStates | undefined;
    if (fragment) {
      const next = omit(fragment, [styleState]);
      if (Object.keys(next).length) {
        set(styleItem, statesPath, next);
      } else {
        set(styleItem, `attributes.${styleSelector}`, omit(get(styleItem, `attributes.${styleSelector}`), ['states']));
      }
    }
  } else {
    const targetPath = getTargetPath(styleSelector);
    set(styleItem, targetPath, {});
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelector;
