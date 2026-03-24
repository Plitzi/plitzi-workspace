import { set } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';
import isValidValue from '../../helpers/isValueValid';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleState, StyleValue } from '@plitzi/sdk-shared';

const addSelectorElement = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
  type: 'element',
  path: StyleCategory | undefined,
  value:
    | Record<string, Partial<Record<StyleCategory, StyleValue>>>
    | Partial<Record<StyleCategory, StyleValue>>
    | StyleValue
    | undefined,
  params: { componentType: string; styleSelector?: string; state?: StyleState }
) => {
  if (!(params as typeof params | undefined)) {
    return false;
  }

  const { componentType, styleSelector, state } = params;
  if (
    getStyleItem(platform, displayMode, selector) ||
    !componentType ||
    (path && path.includes('.')) ||
    !isValidValue(type, path, value, styleSelector ? 1 : 2)
  ) {
    return false;
  }

  const styleItem: StyleItem = { name: selector, type, attributes: {}, stateAttributes: {}, componentType, cache: '' };
  let attributes: Record<string, Partial<Record<StyleCategory, StyleValue>>> = {};
  const key = styleSelector ?? 'base';
  if (path && value !== undefined && (typeof value === 'string' || typeof value === 'number')) {
    attributes[key] = { [path]: value };
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (styleSelector) {
      attributes[key] = value as Partial<Record<StyleCategory, StyleValue>>;
    } else {
      attributes = value as Record<string, Partial<Record<StyleCategory, StyleValue>>>;
    }
  }

  Object.entries(attributes).forEach(([key, val]) => {
    if (state) {
      set(styleItem, `stateAttributes.${key}.${state}`, val);
    } else {
      set(styleItem, `attributes.${key}`, val);
    }
  });

  styleItem.cache = processSelector(styleItem);
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default addSelectorElement;
