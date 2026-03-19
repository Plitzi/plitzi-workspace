import { get, set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';

import { generateCache } from '@plitzi/sdk-style/StyleHelper';

import StyleMap from './StyleMap';

import type {
  DisplayMode,
  Style,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from '@plitzi/sdk-shared';

export const StyleActions = {
  STYLE_UPDATE: 'STYLE_UPDATE',
  STYLE_ADD_SELECTOR: 'STYLE_ADD_SELECTOR',
  STYLE_UPDATE_SELECTOR: 'STYLE_UPDATE_SELECTOR',
  STYLE_REMOVE_SELECTOR: 'STYLE_REMOVE_SELECTOR',
  STYLE_ADD_SELECTOR_VARIABLE: 'STYLE_ADD_SELECTOR_VARIABLE',
  STYLE_UPDATE_SELECTOR_VARIABLE: 'STYLE_UPDATE_SELECTOR_VARIABLE',
  STYLE_REMOVE_SELECTOR_VARIABLE: 'STYLE_REMOVE_SELECTOR_VARIABLE',
  STYLE_ADD_VARIABLE: 'STYLE_ADD_VARIABLE',
  STYLE_UPDATE_VARIABLE: 'STYLE_UPDATE_VARIABLE',
  STYLE_REMOVE_VARIABLE: 'STYLE_REMOVE_VARIABLE',
  STYLE_ADD_TEMPLATE: 'STYLE_ADD_TEMPLATE',
  STYLE_UPDATE_SETTINGS: 'STYLE_UPDATE_SETTINGS'
} as const;

export type StyleReducerActionsBase = { fromSubscriptions?: boolean };

export type StyleReducerActions = StyleReducerActionsBase &
  (
    | { type: 'STYLE_UPDATE'; style: Style }
    | {
        type: 'STYLE_ADD_SELECTOR';
        displayMode: DisplayMode;
        selector: string;
        path?: string;
        selectorType: TagType;
        value?: StyleItem['attributes'];
        params?: { componentType: string };
      }
    | {
        type: 'STYLE_UPDATE_SELECTOR';
        displayMode: DisplayMode;
        selector: string;
        path: string;
        selectorType: TagType;
        value?: StyleItem['attributes'];
      }
    | { type: 'STYLE_REMOVE_SELECTOR'; displayMode?: DisplayMode; selector: string }
    | {
        type: 'STYLE_ADD_SELECTOR_VARIABLE' | 'STYLE_UPDATE_SELECTOR_VARIABLE';
        displayMode: DisplayMode;
        selector: string;
        category: StyleVariableCategory;
        name: string;
        value: StyleVariableValue;
      }
    | {
        type: 'STYLE_REMOVE_SELECTOR_VARIABLE';
        displayMode: DisplayMode;
        selector: string;
        category: StyleVariableCategory;
        name: string;
      }
    | {
        type: 'STYLE_ADD_VARIABLE' | 'STYLE_UPDATE_VARIABLE';
        category: StyleVariableCategory;
        name: string;
        value: StyleVariableValue;
      }
    | { type: 'STYLE_REMOVE_VARIABLE'; category: StyleVariableCategory; name: string }
    | { type: 'STYLE_ADD_TEMPLATE'; platform: Style['platform'] }
    | { type: 'STYLE_UPDATE_SETTINGS'; path: string; value: string }
  );

const StyleReducer = (state: Style, action: StyleReducerActions) => {
  switch (action.type) {
    case StyleActions.STYLE_UPDATE: {
      return { ...state, ...action.style };
    }

    // Selector

    case StyleActions.STYLE_ADD_SELECTOR: {
      const { displayMode, selectorType, selector, path = '', value, params } = action;

      return produce(state, draft => {
        if (StyleMap.addSelector(draft, displayMode, selector, selectorType, path, value, params)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    case StyleActions.STYLE_UPDATE_SELECTOR: {
      const { displayMode, selector, path = '', selectorType = 'class', value } = action;

      return produce(state, draft => {
        if (StyleMap.updateSelector(draft, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR: {
      const { displayMode, selector } = action;

      return produce(state, draft => {
        if (StyleMap.removeSelector(draft, displayMode, selector)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    // Selector Variables

    case StyleActions.STYLE_ADD_SELECTOR_VARIABLE: {
      const { displayMode, selector, category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.addSelectorVariable(draft, displayMode, selector, category, name, value)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    case StyleActions.STYLE_UPDATE_SELECTOR_VARIABLE: {
      const { displayMode, selector, category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.updateSelectorVariable(draft, displayMode, selector, category, name, value)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR_VARIABLE: {
      const { displayMode, selector, category, name } = action;

      return produce(state, draft => {
        if (StyleMap.removeSelectorVariable(draft, displayMode, selector, category, name)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    // Variables

    case StyleActions.STYLE_ADD_VARIABLE: {
      const { category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.addVariable(draft, category, name, value)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    case StyleActions.STYLE_UPDATE_VARIABLE: {
      const { category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.updateVariable(draft, category, name, value)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    case StyleActions.STYLE_REMOVE_VARIABLE: {
      const { category, name } = action;

      return produce(state, draft => {
        if (StyleMap.removeVariable(draft, category, name)) {
          set(draft, 'cache', generateCache(draft));
        }
      });
    }

    // Others

    case StyleActions.STYLE_ADD_TEMPLATE: {
      const { platform: newPlatform } = action;

      return produce(state, draft => {
        const platform = get(draft, 'platform', {}) as Style['platform'];
        (Object.keys(newPlatform) as DisplayMode[]).forEach(mode => {
          platform[mode] = { ...get(platform, mode, {} as Record<string, StyleItem>), ...newPlatform[mode] };
        });
        draft.platform = platform;
        draft.cache = generateCache(draft);
      });
    }

    case StyleActions.STYLE_UPDATE_SETTINGS: {
      const { path, value } = action;

      return produce(state, draft => {
        if (path === 'mode') {
          set(draft, 'mode', value);
        }
      });
    }

    default:
      return state;
  }
};

export default StyleReducer;
