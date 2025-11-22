/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { produce } from 'immer';
import get from 'lodash-es/get';
import omit from 'lodash-es/omit';
import set from 'lodash-es/set';

import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import StyleMap from '@plitzi/sdk-style/StyleMap';

import type { DisplayMode, Style, StyleItem, TagType } from '@plitzi/sdk-shared';

export const StyleActions = {
  STYLE_UPDATE: 'STYLE_UPDATE',
  STYLE_ADD_SELECTOR: 'STYLE_ADD_SELECTOR',
  STYLE_UPDATE_SELECTOR: 'STYLE_UPDATE_SELECTOR',
  STYLE_REMOVE_SELECTOR: 'STYLE_REMOVE_SELECTOR',
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
        path: string;
        selectorType: TagType;
        value: StyleItem['attributes'];
      }
    | {
        type: 'STYLE_UPDATE_SELECTOR';
        displayMode: DisplayMode;
        selector: string;
        path: string;
        selectorType: TagType;
        value: StyleItem['attributes'];
      }
    | { type: 'STYLE_REMOVE_SELECTOR'; selector: string }
    | {
        type: 'STYLE_ADD_VARIABLE' | 'STYLE_UPDATE_VARIABLE';
        variable: string;
        value: string;
      }
    | { type: 'STYLE_REMOVE_VARIABLE'; variable: string }
    | { type: 'STYLE_ADD_TEMPLATE'; platform: Style['platform'] }
    | { type: 'STYLE_UPDATE_SETTINGS'; path: string; value: string }
  );

const StyleReducer = (state: Style, action: StyleReducerActions) => {
  switch (action.type) {
    case StyleActions.STYLE_UPDATE: {
      return { ...state, ...action.style };
    }

    case StyleActions.STYLE_ADD_SELECTOR: {
      const { displayMode, selector, path, selectorType = 'class', value } = action;

      return produce(state, draft => {
        if (StyleMap.addSelector(draft.platform, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        }
      });
    }

    case StyleActions.STYLE_UPDATE_SELECTOR: {
      const { displayMode, selector, path, selectorType = 'class', value } = action;

      return produce(state, draft => {
        if (StyleMap.updateSelector(draft.platform, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        }
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR: {
      const { selector } = action;

      return produce(state, draft => {
        if (StyleMap.removeSelector(draft.platform, selector)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        }
      });
    }

    case StyleActions.STYLE_ADD_VARIABLE:
    case StyleActions.STYLE_UPDATE_VARIABLE: {
      const { variable, value } = action;

      return produce(state, draft => {
        if (!variable) {
          return;
        }

        set(draft, `variables.${variable}`, value);
      });
    }

    case StyleActions.STYLE_REMOVE_VARIABLE: {
      const { variable } = action;

      return produce(state, draft => {
        if (draft.variables[variable]) {
          delete draft.variables[variable];
        }
      });
    }

    case StyleActions.STYLE_ADD_TEMPLATE: {
      const { platform: newPlatform } = action;

      return produce(state, draft => {
        const platform = omit(get(draft, 'platform', {})) as Style['platform'];
        Object.keys(newPlatform).forEach(mode => {
          platform[mode] = { ...get(platform, mode, {}), ...newPlatform[mode] } as Style['platform'];
        });
        draft.platform = platform;
        draft.cache = generateCache({ platform } as Style);
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
