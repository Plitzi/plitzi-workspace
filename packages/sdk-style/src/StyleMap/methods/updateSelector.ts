/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { omit, set, get } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../helpers/processSelector';
import getBasePath from '../helpers/getBasePath';
import getStyleItem from '../helpers/getStyleItem';
import isValidValue, { isStyleObject } from '../helpers/isValueValid';

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
  params: { componentType: string; styleSelector: string; styleState?: StyleState; styleVariant?: string }
) => {
  if (!(params as typeof params | undefined)) {
    return false;
  }

  const { componentType, styleSelector, styleState, styleVariant } = params;
  const styleItem = getStyleItem(platform, displayMode, selector);

  if (
    !styleItem ||
    !styleSelector ||
    (styleState && styleVariant) ||
    (!componentType && styleItem.type === 'element') ||
    (styleSelector && typeof styleSelector !== 'string') ||
    (path && path.includes('.')) ||
    !isValidValue(path, value, params)
  ) {
    return false;
  }

  const basePath = getBasePath(value, styleSelector, path, styleVariant, styleState);

  if (value !== undefined) {
    if (path && (typeof value === 'string' || typeof value === 'number')) {
      set(styleItem, `${basePath}.${path}`, value);
    } else if (value && isStyleObject(value as Partial<StyleObject>) && Object.keys(value).length) {
      const current = get(styleItem, basePath, {});
      const merged = { ...current, ...(value as StyleObject) };
      for (const k in merged) {
        if (merged[k as StyleCategory] === undefined) {
          delete merged[k as StyleCategory];
        }
      }
      set(styleItem, basePath, merged);
    }
  } else if (path) {
    const current = get(styleItem, basePath, {});
    set(styleItem, basePath, omit(current, [path]));
  } else if (styleState) {
    const fragment = get(styleItem, basePath) as StyleStates | undefined;
    if (fragment) {
      const newFragment = omit(fragment, [styleState]);
      if (Object.keys(newFragment).length) {
        set(styleItem, basePath, newFragment);
      } else {
        set(styleItem, `attributes.${styleSelector}`, omit(get(styleItem, `attributes.${styleSelector}`), ['states']));
      }
    }
  } else if (styleVariant) {
    const fragment = get(styleItem, basePath) as StyleVariants | undefined;
    if (fragment) {
      const newFragment = omit(fragment, [styleVariant]);
      if (Object.keys(newFragment).length) {
        set(styleItem, basePath, newFragment);
      } else {
        set(
          styleItem,
          `attributes.${styleSelector}`,
          omit(get(styleItem, `attributes.${styleSelector}`), ['variants'])
        );
      }
    }
  } else {
    set(styleItem, basePath, {});
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelector;
