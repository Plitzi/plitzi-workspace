// Packages
import omit from 'lodash/omit';
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';

// Monorepo
import FlatMap from '@plitzi/sdk-schema/FlatMap';
import { generateCache, processSelector } from '@plitzi/sdk-style/StyleHelper';

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
  SEGMENTS_ADD_SELECTOR: 'SEGMENTS_ADD_SELECTOR',
  SEGMENTS_UPDATE_SELECTOR: 'SEGMENTS_UPDATE_SELECTOR',
  SEGMENTS_REMOVE_SELECTOR: 'SEGMENTS_REMOVE_SELECTOR',
  SEGMENTS_ADD_VARIABLE: 'SEGMENTS_ADD_VARIABLE',
  SEGMENTS_UPDATE_VARIABLE: 'SEGMENTS_UPDATE_VARIABLE',
  SEGMENTS_REMOVE_VARIABLE: 'SEGMENTS_REMOVE_VARIABLE'
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
        FlatMap.addElement(get(draft, `${identifier}.schema.flat`), data, to, dropPosition, initialItems);
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_ELEMENT: {
      const { elementId } = action;

      return produce(state, draft => {
        FlatMap.removeElement(get(draft, `${identifier}.schema.flat`), elementId);
      });
    }

    case SegmentsActions.SEGMENTS_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action;

      return produce(state, draft => {
        FlatMap.addElement(get(draft, `${identifier}.schema.flat`), data, to, dropPosition, initialItems);
      });
    }

    case SegmentsActions.SEGMENTS_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action;

      return produce(state, draft => {
        FlatMap.moveElement(get(draft, `${identifier}.schema.flat`), from, to, elementId, dropPosition);
      });
    }

    case SegmentsActions.SEGMENTS_UPDATE_ELEMENT: {
      const { element } = action;

      return produce(state, draft => {
        set(draft, `${identifier}.schema.flat[${element.id}]`, element);
      });
    }

    case SegmentsActions.SEGMENTS_ADD_SELECTOR:
    case SegmentsActions.SEGMENTS_UPDATE_SELECTOR: {
      const { displayMode, selector, selectorType = 'class', path, value } = action;

      if (!path) {
        return produce(state, draft => {
          const selectorInstance = get(draft, `${identifier}.style.platform.${displayMode}.${selector}`, {
            name: selector,
            type: selectorType,
            attributes: {},
            cache: ''
          });

          if (value) {
            set(selectorInstance, 'attributes', value);
          }

          set(draft, `${identifier}.style.platform.${displayMode}.${selector}`, {
            ...selectorInstance,
            cache: processSelector(selector, selectorType, selectorInstance.attributes)
          });

          set(
            draft,
            `${identifier}.style.cache`,
            generateCache({ platform: get(draft, `${identifier}.style.platform`) })
          );
        });
      }

      return produce(state, draft => {
        const selectorInstance = get(draft, `${identifier}.style.platform.${displayMode}.${selector}`, {
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

        set(draft, `${identifier}.style.platform.${displayMode}.${selector}`, {
          ...selectorInstance,
          cache: processSelector(selector, selectorType, selectorInstance.attributes)
        });

        set(
          draft,
          `${identifier}.style.cache`,
          generateCache({ platform: get(draft, `${identifier}.style.platform`) })
        );
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_SELECTOR: {
      const { selector } = action;

      return produce(state, draft => {
        const platform = omit(get(draft, `${identifier}.style.platform`, {}));
        Object.keys(platform).forEach(pkey => {
          platform[pkey] = omit(platform[pkey], [selector]);
        });
        set(draft, `${identifier}.style.platform`, platform);
        set(draft, `${identifier}.style.cache`, generateCache({ platform }));
      });
    }

    case SegmentsActions.SEGMENTS_ADD_VARIABLE:
    case SegmentsActions.SEGMENTS_UPDATE_VARIABLE: {
      const { variable, value } = action;

      return produce(state, draft => {
        if (!variable) {
          return;
        }

        set(draft, `${identifier}.style.variables.${variable}`, value);
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_VARIABLE: {
      const { variable } = action;

      return produce(state, draft => {
        if (draft[identifier].style.variables[variable]) {
          delete draft[identifier].style.variables[variable];
        }
      });
    }

    case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
      const { to, data, dropPosition, initialItems, templatePlatform, variables } = action;
      const newState = produce(state, draft => {
        if (!draft[identifier]) {
          return;
        }

        FlatMap.addElement(get(draft, `${identifier}.schema.flat`), data, to, dropPosition, initialItems);
        const platform = get(draft, `${identifier}.style.platform`);
        const currentVariables = get(draft, `${identifier}.schema.variables`, []);
        Object.keys(templatePlatform).forEach(mode => {
          platform[mode] = { ...get(platform, mode, {}), ...templatePlatform[mode] };
        });
        set(draft, `${identifier}.style.cache`, generateCache({ platform }));

        if (variables?.length > 0) {
          const variablesToAppend = variables.filter(variable => !currentVariables.find(v => v.name === variable.name));
          set(draft, `${identifier}.schema.variables`, [...currentVariables, ...variablesToAppend]);
        }
      });

      return newState;
    }

    default:
      return state;
  }
};

export default SegmentsReducer;
