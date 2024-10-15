// Packages
import omit from 'lodash/omit';
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';

// Monorepo
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import StyleMap from '@plitzi/sdk-style/StyleMap';

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

const StyleReducer = (state, action = {}) => {
  switch (action.type) {
    case StyleActions.STYLE_UPDATE: {
      return { ...state, ...action.style };
    }

    case StyleActions.STYLE_ADD_SELECTOR: {
      const { displayMode, selector, path, selectorType = 'class', value } = action;

      return produce(state, draft => {
        if (StyleMap.addSelector(draft.platform, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') }));
        }
      });
    }

    case StyleActions.STYLE_UPDATE_SELECTOR: {
      const { displayMode, selector, path, selectorType = 'class', value } = action;

      return produce(state, draft => {
        if (StyleMap.updateSelector(draft.platform, displayMode, selector, selectorType, path, value)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') }));
        }
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR: {
      const { selector } = action;

      return produce(state, draft => {
        if (StyleMap.removeSelector(draft.platform, selector)) {
          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') }));
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
        const platform = omit(get(draft, 'platform', {}));
        Object.keys(newPlatform).forEach(mode => {
          platform[mode] = { ...get(platform, mode, {}), ...newPlatform[mode] };
        });
        draft.platform = platform;
        draft.cache = generateCache({ platform });
      });
    }

    default:
      return state;
  }
};

export default StyleReducer;
