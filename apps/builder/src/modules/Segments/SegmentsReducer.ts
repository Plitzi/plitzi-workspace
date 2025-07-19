/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { produce } from 'immer';
import get from 'lodash/get';
import omit from 'lodash/omit';
import set from 'lodash/set';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { generateCache, processSelector } from '@plitzi/sdk-style/StyleHelper';

import type {
  DisplayMode,
  Element,
  Schema,
  SchemaVariable,
  Segment,
  Style,
  StyleItem,
  TagType,
  DropPosition
} from '@plitzi/sdk-shared';

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

const SegmentsReducer = (
  state: Record<string, Segment>,
  action: { type: keyof typeof SegmentsActions; segmentId: string; segment?: Segment }
) => {
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
      const { to, data, dropPosition, initialItems } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        to: Element['id'];
        data: Element;
        dropPosition: DropPosition;
        initialItems: Record<string, Element>;
      };

      return produce(state, (draft: Record<string, Segment>) => {
        FlatMap.addElement(
          get(draft, `${identifier}.schema.flat`) as unknown as Schema['flat'],
          data,
          to,
          dropPosition,
          initialItems
        );
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_ELEMENT: {
      const { elementId } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        elementId: string;
      };

      return produce(state, draft => {
        FlatMap.removeElement(get(draft, `${identifier}.schema.flat`) as unknown as Schema['flat'], elementId);
      });
    }

    case SegmentsActions.SEGMENTS_CLONE_ELEMENT: {
      const { to, data, dropPosition, initialItems } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        to: string;
        data: Element;
        dropPosition: DropPosition;
        initialItems: Record<string, Element>;
      };

      return produce(state, draft => {
        FlatMap.addElement(
          get(draft, `${identifier}.schema.flat`) as unknown as Schema['flat'],
          data,
          to,
          dropPosition,
          initialItems
        );
      });
    }

    case SegmentsActions.SEGMENTS_MOVE_ELEMENT: {
      const { from, to, elementId, dropPosition } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        from: string;
        to: string;
        elementId: string;
        dropPosition: DropPosition;
      };

      return produce(state, draft => {
        FlatMap.moveElement(
          get(draft, `${identifier}.schema.flat`) as unknown as Schema['flat'],
          from,
          to,
          elementId,
          dropPosition
        );
      });
    }

    case SegmentsActions.SEGMENTS_UPDATE_ELEMENT: {
      const { element } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        element: Element;
      };

      return produce(state, draft => {
        set(draft, `${identifier}.schema.flat[${element.id}]`, element);
      });
    }

    case SegmentsActions.SEGMENTS_ADD_SELECTOR:
    case SegmentsActions.SEGMENTS_UPDATE_SELECTOR: {
      const {
        displayMode,
        selector,
        selectorType = 'class',
        path,
        value
      } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        displayMode: DisplayMode;
        selector: string;
        selectorType: TagType;
        path: string;
        value?: StyleItem['attributes'];
      };

      if (!path) {
        return produce(state, draft => {
          const segment = get(draft, identifier) as Segment;
          const selectorInstance = get(segment, `style.platform.${displayMode}.${selector}`, {
            name: selector,
            type: selectorType,
            attributes: {},
            cache: ''
          }) as StyleItem;

          if (value) {
            set(selectorInstance, 'attributes', value);
          }

          set(segment, `style.platform.${displayMode}.${selector}`, {
            ...selectorInstance,
            cache: processSelector(selector, selectorType, selectorInstance.attributes)
          });

          set(segment, 'style.cache', generateCache({ platform: get(segment, 'style.platform') } as Style));
        });
      }

      return produce(state, draft => {
        const selectorInstance = get(draft, `${identifier}.style.platform.${displayMode}.${selector}`, {
          name: selector,
          type: selectorType,
          attributes: {},
          cache: ''
        }) as StyleItem;
        const segment = get(draft, identifier) as Segment;
        if (!value) {
          const newPath = ['attributes', ...path.split('.')];
          const pathToRemove = newPath.pop() as string;
          set(selectorInstance, newPath, omit(get(selectorInstance, newPath.join('.'), {}), [pathToRemove]));
        } else {
          set(selectorInstance, `attributes.${path}`, value);
        }

        set(segment, `style.platform.${displayMode}.${selector}`, {
          ...selectorInstance,
          cache: processSelector(selector, selectorType, selectorInstance.attributes)
        });

        set(segment, 'style.cache', generateCache({ platform: get(segment, 'style.platform') } as Style));
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_SELECTOR: {
      const { selector } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        selector: string;
      };

      return produce(state, draft => {
        const platform = omit(get(draft, `${identifier}.style.platform`, {}));
        Object.keys(platform).forEach(pkey => {
          platform[pkey] = omit(platform[pkey], [selector]);
        });
        set(draft, `${identifier}.style.platform`, platform);
        set(draft, `${identifier}.style.cache`, generateCache({ platform } as Style));
      });
    }

    case SegmentsActions.SEGMENTS_ADD_VARIABLE:
    case SegmentsActions.SEGMENTS_UPDATE_VARIABLE: {
      const { variable, value } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        variable: string;
        value: string;
      };

      return produce(state, draft => {
        if (!variable) {
          return;
        }

        set(draft, `${identifier}.style.variables.${variable}`, value);
      });
    }

    case SegmentsActions.SEGMENTS_REMOVE_VARIABLE: {
      const { variable } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        variable: string;
      };

      return produce(state, draft => {
        if (draft[identifier].style.variables[variable]) {
          delete draft[identifier].style.variables[variable];
        }
      });
    }

    case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
      const { to, data, dropPosition, initialItems, templatePlatform, variables } = action as {
        type: keyof typeof SegmentsActions;
        segmentId: string;
        segment?: Segment;
        to: string;
        data: Element;
        dropPosition: DropPosition;
        initialItems: Record<string, Element>;
        templatePlatform: Style['platform'];
        variables: SchemaVariable[];
      };
      const newState = produce(state, draft => {
        const segment = draft[identifier] as Segment | undefined;
        if (!segment) {
          return;
        }

        FlatMap.addElement(
          get(draft, `${identifier}.schema.flat`) as unknown as Schema['flat'],
          data,
          to,
          dropPosition,
          initialItems
        );
        const platform = get(segment, 'style.platform');
        const currentVariables = get(segment, 'schema.variables', []) as SchemaVariable[];
        Object.keys(templatePlatform).forEach(mode => {
          platform[mode as DisplayMode] = { ...get(platform, mode, {}), ...templatePlatform[mode as DisplayMode] };
        });
        set(draft, `${identifier}.style.cache`, generateCache({ platform } as Style));

        if (variables.length > 0) {
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
