import { produce } from 'immer';
import get from 'lodash-es/get.js';
import omit from 'lodash-es/omit.js';
import set from 'lodash-es/set.js';

import processSelector from './helpers/processSelector';
import { generateCache } from './StyleHelper';

import type { DisplayMode, Style, StyleItem } from '@plitzi/sdk-shared';

export const StyleActions = {
  STYLE_UPDATE: 'STYLE_UPDATE',
  STYLE_ADD_SELECTOR: 'STYLE_ADD_SELECTOR',
  STYLE_UPDATE_SELECTOR: 'STYLE_UPDATE_SELECTOR',
  STYLE_REMOVE_SELECTOR: 'STYLE_REMOVE_SELECTOR',
  STYLE_ADD_TEMPLATE: 'STYLE_ADD_TEMPLATE'
};

type Action = {
  type?:
    | 'STYLE_UPDATE'
    | 'STYLE_ADD_SELECTOR'
    | 'STYLE_UPDATE_SELECTOR'
    | 'STYLE_REMOVE_SELECTOR'
    | 'STYLE_ADD_TEMPLATE';
  style?: Style;
  displayMode?: string;
  selector: string;
  path?: string;
  value?: StyleItem['attributes'];
  platform?: Style['platform'];
};

const StyleReducer = (state: Style, action: Partial<Action> = {}) => {
  switch (action.type) {
    case StyleActions.STYLE_UPDATE: {
      return { ...state, ...action.style };
    }

    case StyleActions.STYLE_ADD_SELECTOR:
    case StyleActions.STYLE_UPDATE_SELECTOR: {
      const { displayMode, selector, path, value } = action as Action;
      if (!path) {
        return produce(state, draft => {
          const selectorInstance = get(draft, `platform.${displayMode}.${btoa(selector)}`, {
            name: selector,
            attributes: {} as StyleItem['attributes'],
            cache: ''
          });

          if (value) {
            set(selectorInstance, 'attributes', value);
          }

          set(draft, `platform.${displayMode}.${btoa(selector)}`, {
            ...selectorInstance,
            cache: processSelector(selector, 'class', selectorInstance.attributes)
          });

          set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
        });
      }

      return produce(state, draft => {
        const selectorInstance = get(draft, `platform.${displayMode}.${btoa(selector)}`, {
          name: selector,
          attributes: {},
          cache: ''
        });

        if (!value) {
          const newPath = ['attributes', ...path.split('.')];
          const pathToRemove = newPath.pop() as string;
          const newPathStr = newPath.join('.');
          set(selectorInstance, newPathStr, omit(get(selectorInstance, newPathStr, {}), [pathToRemove]));
        } else {
          set(selectorInstance, `attributes.${path}`, value);
        }

        set(draft, `platform.${displayMode}.${btoa(selector)}`, {
          ...selectorInstance,
          cache: processSelector(selector, 'class', selectorInstance.attributes)
        });

        set(draft, 'cache', generateCache({ platform: get(draft, 'platform') } as Style));
      });
    }

    case StyleActions.STYLE_REMOVE_SELECTOR: {
      const { selector } = action;
      if (!selector) {
        return state;
      }

      return produce(state, draft => {
        const platform = omit(get(draft, 'platform', {})) as Style['platform'];
        Object.keys(platform).forEach(pkey => {
          platform[pkey as DisplayMode] = omit(platform[pkey as DisplayMode], [selector]);
        });
        draft.platform = platform;
        draft.cache = generateCache({ platform } as Style);
      });
    }

    case StyleActions.STYLE_ADD_TEMPLATE: {
      return produce(state, draft => {
        const platform = omit(get(draft, 'platform', {})) as Style['platform'];
        if (!action.platform) {
          return;
        }

        Object.keys(action.platform).forEach(mode => {
          if (!action.platform) {
            return;
          }

          platform[mode as DisplayMode] = { ...get(platform, mode, {}), ...action.platform[mode as DisplayMode] };
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
