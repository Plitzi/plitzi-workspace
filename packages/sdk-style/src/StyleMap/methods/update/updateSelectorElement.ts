import { omit, set, get } from '@plitzi/plitzi-ui/helpers';

import processSelector from '../../../helpers/processSelector';
import getStyleItem from '../../helpers/getStyleItem';
import isValidValue from '../../helpers/isValueValid';

import type { DisplayMode, Style, StyleCategory, StyleItem, StyleState, StyleValue } from '@plitzi/sdk-shared';

const updateSelectorElement = (
  platform: Style['platform'],
  displayMode: DisplayMode,
  selector: string,
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
  const styleItem = getStyleItem(platform, displayMode, selector) as
    | Extract<StyleItem, { type: 'element' }>
    | undefined;
  if (
    !styleItem ||
    !componentType ||
    (path && path.includes('.')) ||
    !isValidValue(styleItem.type, path, value, params.styleSelector ? 1 : 2)
  ) {
    return false;
  }

  const key = styleSelector ?? 'base';
  let attributes: Record<string, Partial<Record<StyleCategory, StyleValue>>> = {};
  if (path && value !== undefined && typeof value !== 'object') {
    attributes[key] = { [path]: value };
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (styleSelector) {
      attributes[key] = value as Partial<Record<StyleCategory, StyleValue>>;
    } else {
      attributes = value as Record<string, Partial<Record<StyleCategory, StyleValue>>>;
    }
  }

  Object.entries(attributes).forEach(([selectorKey, val]) => {
    const basePath = state ? `stateAttributes.${selectorKey}.${state}` : `attributes.${selectorKey}`;
    if (path && val[path] !== undefined) {
      set(styleItem, `${basePath}.${path}`, val[path]);
    } else if (!path) {
      set(styleItem, basePath, val);
    }
  });

  if (value === undefined) {
    if (path) {
      const basePath = state ? `stateAttributes.${key}.${state}` : `attributes.${key}`;
      const current = get(styleItem, basePath, {});
      set(styleItem, basePath, omit(current, [path]));
    } else {
      if (styleSelector) {
        // reset only one styleSelector
        const basePath = state ? `stateAttributes.${key}.${state}` : `attributes.${key}`;
        set(styleItem, basePath, {});
      } else {
        // reset all styleSelectors
        const containerPath = state ? 'stateAttributes' : 'attributes';
        const container = get(styleItem, containerPath, {});
        Object.keys(container).forEach(selectorKey => {
          const basePath = state ? `stateAttributes.${selectorKey}.${state}` : `attributes.${selectorKey}`;
          set(styleItem, basePath, {});
        });
      }
    }
  }

  set(styleItem, 'cache', processSelector(styleItem));
  set(platform, `${displayMode}.${selector}`, styleItem);

  return true;
};

export default updateSelectorElement;
