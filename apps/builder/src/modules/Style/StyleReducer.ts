/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { produce } from 'immer';
import get from 'lodash/get';
import omit from 'lodash/omit';
import set from 'lodash/set';

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
  STYLE_ADD_TEMPLATE: 'STYLE_ADD_TEMPLATE'
};

const StyleReducer = (
  state: Style,
  action: { type: keyof typeof StyleActions } & Record<Exclude<string, 'type'>, unknown>
) => {
  switch (action.type) {
    case StyleActions.STYLE_UPDATE: {
      return { ...state, ...(action.style as Style) };
    }

    case StyleActions.STYLE_ADD_SELECTOR: {
      const {
        displayMode,
        selector,
        path,
        selectorType = 'class',
        value
      } = action as {
        type: keyof typeof StyleActions;
        displayMode: DisplayMode;
        selector: string;
        path: string;
        selectorType?: TagType;
        value: StyleItem['attributes'];
      };

      return produce(state, draft => {
        if (StyleMap.addSelector(draft.platform, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        }
      });
    }

    case StyleActions.STYLE_UPDATE_SELECTOR: {
      const {
        displayMode,
        selector,
        path,
        selectorType = 'class',
        value
      } = action as {
        type: keyof typeof StyleActions;
        displayMode: DisplayMode;
        selector: string;
        path: string;
        selectorType?: TagType;
        value: StyleItem['attributes'];
      };

      return produce(state, draft => {
        if (StyleMap.updateSelector(draft.platform, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        }
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR: {
      const { selector } = action as { type: keyof typeof StyleActions; selector: string };

      return produce(state, draft => {
        if (StyleMap.removeSelector(draft.platform, selector)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        }
      });
    }

    case StyleActions.STYLE_ADD_VARIABLE:
    case StyleActions.STYLE_UPDATE_VARIABLE: {
      const { variable, value } = action as { type: keyof typeof StyleActions; variable: string; value: string };

      return produce(state, draft => {
        if (!variable) {
          return;
        }

        set(draft, `variables.${variable}`, value);
      });
    }

    case StyleActions.STYLE_REMOVE_VARIABLE: {
      const { variable } = action as { type: keyof typeof StyleActions; variable: 'string' };

      return produce(state, draft => {
        if (draft.variables[variable]) {
          delete draft.variables[variable];
        }
      });
    }

    case StyleActions.STYLE_ADD_TEMPLATE: {
      const { platform: newPlatform } = action as { type: keyof typeof StyleActions; platform: Style['platform'] };

      return produce(state, draft => {
        const platform = omit(get(draft, 'platform', {})) as Style['platform'];
        Object.keys(newPlatform).forEach(mode => {
          platform[mode] = { ...get(platform, mode, {}), ...newPlatform[mode] } as Style['platform'];
        });
        draft.platform = platform;
        draft.cache = generateCache({ platform } as Style);
      });
    }

    default:
      return state;
  }
};

export default StyleReducer;
