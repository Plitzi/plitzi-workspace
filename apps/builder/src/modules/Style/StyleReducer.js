// Packages
import omit from 'lodash/omit';
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';

// Monorepo
import { generateCache, processSelector } from '@plitzi/sdk-style/StyleHelper';

export const StyleActions = {
  STYLE_UPDATE: 'STYLE_UPDATE',
  STYLE_ADD_SELECTOR: 'STYLE_ADD_SELECTOR',
  STYLE_UPDATE_SELECTOR: 'STYLE_UPDATE_SELECTOR',
  STYLE_REMOVE_SELECTOR: 'STYLE_REMOVE_SELECTOR',
  STYLE_ADD_TEMPLATE: 'STYLE_ADD_TEMPLATE'
};

const StyleReducer = (state, action = {}) => {
  switch (action.type) {
    case StyleActions.STYLE_UPDATE: {
      return { ...state, ...action.style };
    }

    case StyleActions.STYLE_ADD_SELECTOR:
    case StyleActions.STYLE_UPDATE_SELECTOR: {
      const { displayMode, selector, path, selectorType = 'class', value } = action;
      if (!path) {
        return produce(state, draft => {
          const selectorInstance = get(draft, `platform.${displayMode}.${selector}`, {
            name: selector,
            type: selectorType,
            attributes: {},
            cache: ''
          });

          if (value) {
            set(selectorInstance, 'attributes', value);
          }

          set(draft, `platform.${displayMode}.${selector}`, {
            ...selectorInstance,
            cache: processSelector(selector, selectorType, selectorInstance.attributes)
          });

          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') }));
        });
      }

      return produce(state, draft => {
        const selectorInstance = get(draft, `platform.${displayMode}.${selector}`, {
          name: selector,
          type: selectorType,
          attributes: {},
          cache: ''
        });

        if (!value) {
          let newPath = ['attributes', ...path.split('.')];
          const pathToRemove = newPath.pop();
          newPath = newPath.join('.');
          set(selectorInstance, newPath, omit(get(selectorInstance, newPath, {}), [pathToRemove]));
        } else {
          set(selectorInstance, `attributes.${path}`, value);
        }

        set(draft, `platform.${displayMode}.${selector}`, {
          ...selectorInstance,
          cache: processSelector(selector, selectorType, selectorInstance.attributes)
        });

        set(draft, 'cache', generateCache({ platform: get(draft, 'platform') }));
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR: {
      const { selector } = action;

      return produce(state, draft => {
        const platform = omit(get(draft, 'platform', {}));
        Object.keys(platform).forEach(pkey => {
          platform[pkey] = omit(platform[pkey], [selector]);
        });
        draft.platform = platform;
        draft.cache = generateCache({ platform });
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
