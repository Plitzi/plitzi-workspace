// Packages
import omit from 'lodash/omit';
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';

// Monorepo
import FlatMap from '@plitzi/sdk-schema/FlatMap';

// Alias
import { generateCache, processSelector } from '@pmodules/Style/StyleHelper';

export const SegmentsActions = {
  SEGMENTS_ADD: 'SEGMENTS_ADD',
  SEGMENTS_UPDATE: 'SEGMENTS_UPDATE',
  SEGMENTS_REMOVE: 'SEGMENTS_REMOVE',
  SEGMENTS_ADD_TEMPLATE: 'SEGMENTS_ADD_TEMPLATE',
  SEGMENTS_ADD_ELEMENT: 'SEGMENTS_ADD_ELEMENT',
  SEGMENTS_REMOVE_ELEMENT: 'SEGMENTS_REMOVE_ELEMENT',
  SEGMENTS_MOVE_ELEMENT: 'SEGMENTS_MOVE_ELEMENT',
  SEGMENTS_CLONE_ELEMENT: 'SEGMENTS_CLONE_ELEMENT',
  SEGMENTS_UPDATE_ELEMENT: 'SEGMENTS_UPDATE_ELEMENT',
  SEGMENTS_SELECTOR_ADD: 'SEGMENTS_SELECTOR_ADD',
  SEGMENTS_SELECTOR_UPDATE: 'SEGMENTS_SELECTOR_UPDATE',
  SEGMENTS_SELECTOR_REMOVE: 'SEGMENTS_SELECTOR_REMOVE'
};

const SegmentsReducer = (state, action = {}) => {
  const { segmentId } = action;
  let { segment } = action;
  if (segmentId && !segment) {
    segment = Object.values(state).find(segment => segment.id === segmentId);
  }

  if (!segment) {
    return state;
  }

  const { identifier } = segment;

  switch (action.type) {
    case SegmentsActions.SEGMENTS_ADD:
    case SegmentsActions.SEGMENTS_UPDATE: {
      return { ...state, [identifier]: segment };
    }

    case SegmentsActions.SEGMENTS_REMOVE: {
      return omit(state, [identifier]);
    }

    case SegmentsActions.SEGMENTS_ADD_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;

      return produce(state, draft => {
        FlatMap.add(get(draft, `${identifier}.schema.flat`), to, data, dropPosition, initialItems);
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_ELEMENT: {
      const { elementId } = action;

      return produce(state, draft => {
        FlatMap.remove(get(draft, `${identifier}.schema.flat`), elementId);
      });
    }

    case SegmentsActions.SEGMENTS_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;

      return produce(state, draft => {
        FlatMap.add(get(draft, `${identifier}.schema.flat`), to, data, dropPosition, initialItems);
      });
    }

    case SegmentsActions.SEGMENTS_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action;

      return produce(state, draft => {
        FlatMap.move(get(draft, `${identifier}.schema.flat`), from, to, elementId, dropPosition);
      });
    }

    case SegmentsActions.SEGMENTS_UPDATE_ELEMENT: {
      const { element } = action;

      return produce(state, draft => {
        set(draft, `${identifier}.schema.flat[${element.id}]`, element);
      });
    }

    case SegmentsActions.SEGMENTS_SELECTOR_ADD:
    case SegmentsActions.SEGMENTS_SELECTOR_UPDATE: {
      const { displayMode, selector, path, value } = action;

      if (!path) {
        return produce(state, draft => {
          const selectorInstance = get(draft, `${identifier}.style.platform.${displayMode}.${btoa(selector)}`, {
            name: selector,
            attributes: {},
            cache: ''
          });

          if (value) {
            set(selectorInstance, 'attributes', value);
          }

          set(draft, `${identifier}.style.platform.${displayMode}.${btoa(selector)}`, {
            ...selectorInstance,
            cache: `${selector}{${processSelector(selectorInstance.attributes)}}`
          });

          set(
            draft,
            `${identifier}.style.cache`,
            generateCache({ platform: get(draft, `${identifier}.style.platform`) })
          );
        });
      }

      return produce(state, draft => {
        const selectorInstance = get(draft, `${identifier}.style.platform.${displayMode}.${btoa(selector)}`, {
          name: selector,
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

        set(draft, `${identifier}.style.platform.${displayMode}.${btoa(selector)}`, {
          ...selectorInstance,
          cache: `${selector}{${processSelector(selectorInstance.attributes)}}`
        });

        set(
          draft,
          `${identifier}.style.cache`,
          generateCache({ platform: get(draft, `${identifier}.style.platform`) })
        );
      });
    }

    case SegmentsActions.SEGMENTS_SELECTOR_REMOVE: {
      const { selector } = action;

      const newState = produce(state, draft => {
        const platform = omit(get(draft, `${identifier}.style.platform`, {}));
        Object.keys(platform).forEach(pkey => {
          platform[pkey] = omit(platform[pkey], [selector]);
        });
        set(draft, `${identifier}.style.platform`, platform);
        set(draft, `${identifier}.style.cache`, generateCache({ platform }));
      });

      return newState;
    }

    case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
      const { to, data, dropPosition, initialItems, templatePlatform } = action;
      const newState = produce(state, draft => {
        if (!draft[identifier]) {
          return;
        }

        FlatMap.add(get(draft, `${identifier}.schema.flat`), to, data, dropPosition, initialItems);
        const platform = get(draft, `${identifier}.style.platform`);
        Object.keys(templatePlatform).forEach(mode => {
          platform[mode] = { ...get(platform, mode, {}), ...templatePlatform[mode] };
        });
        set(draft, `${identifier}.style.cache`, generateCache({ platform }));
      });

      return newState;
    }

    default:
      return state;
  }
};

export default SegmentsReducer;
