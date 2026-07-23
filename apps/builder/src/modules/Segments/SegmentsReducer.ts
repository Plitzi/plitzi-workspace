import { get, set, omit } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import StyleMap from '@plitzi/sdk-style/StyleMap';

import type {
  DisplayMode,
  Element,
  SchemaVariable,
  Segment,
  Style,
  StyleItem,
  TagType,
  DropPosition,
  StyleVariableCategory,
  StyleVariableValue,
  StyleCategory,
  StyleState
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
  SEGMENTS_UPDATE_ELEMENTS: 'SEGMENTS_UPDATE_ELEMENTS',
  SEGMENTS_SPACE_ADD_VARIABLE: 'SEGMENTS_SPACE_ADD_VARIABLE',
  SEGMENTS_SPACE_UPDATE_VARIABLE: 'SEGMENTS_SPACE_UPDATE_VARIABLE',
  SEGMENTS_SPACE_REMOVE_VARIABLE: 'SEGMENTS_SPACE_REMOVE_VARIABLE',
  SEGMENTS_STYLE_ADD_SELECTOR: 'SEGMENTS_STYLE_ADD_SELECTOR',
  SEGMENTS_STYLE_UPDATE_SELECTOR: 'SEGMENTS_STYLE_UPDATE_SELECTOR',
  SEGMENTS_STYLE_REMOVE_SELECTOR: 'SEGMENTS_STYLE_REMOVE_SELECTOR',
  SEGMENTS_STYLE_REMOVE_SELECTORS: 'SEGMENTS_STYLE_REMOVE_SELECTORS',
  SEGMENTS_STYLE_ADD_SELECTOR_VARIABLE: 'SEGMENTS_STYLE_ADD_SELECTOR_VARIABLE',
  SEGMENTS_STYLE_UPDATE_SELECTOR_VARIABLE: 'SEGMENTS_STYLE_UPDATE_SELECTOR_VARIABLE',
  SEGMENTS_STYLE_REMOVE_SELECTOR_VARIABLE: 'SEGMENTS_STYLE_REMOVE_SELECTOR_VARIABLE',
  SEGMENTS_STYLE_ADD_VARIABLE: 'SEGMENTS_STYLE_ADD_VARIABLE',
  SEGMENTS_STYLE_UPDATE_VARIABLE: 'SEGMENTS_STYLE_UPDATE_VARIABLE',
  SEGMENTS_STYLE_REMOVE_VARIABLE: 'SEGMENTS_STYLE_REMOVE_VARIABLE'
} as const;

type SegmentsReducerActionsBase = { segmentId: string; segment?: Segment; fromSubscriptions?: boolean };

export type SegmentsReducerActions =
  | ({ type: 'SEGMENTS_ADD' } & SegmentsReducerActionsBase)
  | ({ type: 'SEGMENTS_UPDATE' } & SegmentsReducerActionsBase)
  | ({ type: 'SEGMENTS_REMOVE' } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_ADD_ELEMENT';
      to: Element['id'];
      data: Element;
      dropPosition: DropPosition;
      initialItems: Record<string, Element>;
      variables: SchemaVariable[];
    } & SegmentsReducerActionsBase)
  | ({ type: 'SEGMENTS_REMOVE_ELEMENT'; elementId: string } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_CLONE_ELEMENT';
      to: string;
      data: Element;
      dropPosition: DropPosition;
      initialItems: Record<string, Element>;
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_MOVE_ELEMENT';
      from: string;
      to: string;
      elementId: string;
      dropPosition: DropPosition;
    } & SegmentsReducerActionsBase)
  | ({ type: 'SEGMENTS_UPDATE_ELEMENT'; element: Element } & SegmentsReducerActionsBase)
  | ({ type: 'SEGMENTS_UPDATE_ELEMENTS'; elements: Element[] } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_SPACE_ADD_VARIABLE' | 'SEGMENTS_SPACE_UPDATE_VARIABLE';
      variable: SchemaVariable;
    } & SegmentsReducerActionsBase)
  | ({ type: 'SEGMENTS_SPACE_REMOVE_VARIABLE'; name: string } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_ADD_SELECTOR';
      displayMode: DisplayMode;
      selector: string;
      selectorType: TagType;
      path?: StyleCategory;
      value?: StyleItem['attributes'];
      params: {
        componentType?: string;
        styleSelector?: string;
        styleState?: StyleState;
        styleVariant?: string;
      };
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_UPDATE_SELECTOR';
      displayMode: DisplayMode;
      selector: string;
      path?: StyleCategory;
      value?: StyleItem['attributes'];
      params: {
        componentType?: string;
        styleSelector: string;
        styleState?: StyleState;
        styleVariant?: string;
      };
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_REMOVE_SELECTOR';
      displayMode: DisplayMode;
      selector: string;
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_REMOVE_SELECTORS';
      displayMode: DisplayMode;
      selectors: string[];
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_ADD_SELECTOR_VARIABLE' | 'SEGMENTS_STYLE_UPDATE_SELECTOR_VARIABLE';
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_REMOVE_SELECTOR_VARIABLE';
      displayMode: DisplayMode;
      selector: string;
      category: StyleVariableCategory;
      name: string;
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_ADD_VARIABLE' | 'SEGMENTS_STYLE_UPDATE_VARIABLE';
      category: StyleVariableCategory;
      name: string;
      value: StyleVariableValue;
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_STYLE_REMOVE_VARIABLE';
      category: StyleVariableCategory;
      name: string;
    } & SegmentsReducerActionsBase)
  | ({
      type: 'SEGMENTS_ADD_TEMPLATE';
      to: string;
      data: Element;
      dropPosition: DropPosition;
      initialItems: Record<string, Element>;
      templatePlatform: Style['platform'];
      variables: SchemaVariable[];
    } & SegmentsReducerActionsBase);

const SegmentsReducer = (state: Record<string, Segment>, action: SegmentsReducerActions) => {
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
      const { to, data, dropPosition, initialItems, variables } = action;

      return produce(state, (draft: Record<string, Segment>) => {
        FlatMap.addElement(get(draft, `${identifier}.schema.flat`), data, to, dropPosition, initialItems);

        if (variables.length > 0) {
          set(
            draft,
            `${identifier}.schema.variables`,
            FlatMap.addVariables(get(draft, `${identifier}.schema.variables`, []) as SchemaVariable[], variables)
          );
        }
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

    case SegmentsActions.SEGMENTS_UPDATE_ELEMENTS: {
      const { elements } = action;

      return produce(state, draft => {
        elements.forEach(element => set(draft, `${identifier}.schema.flat[${element.id}]`, element));
      });
    }

    case SegmentsActions.SEGMENTS_SPACE_ADD_VARIABLE: {
      const { variable } = action;

      return produce(state, draft => {
        if (!(segment.schema.variables as SchemaVariable[] | undefined)) {
          set(draft, `${identifier}.schema.variables`, []);
        }

        FlatMap.addVariable(get(draft, `${identifier}.schema.variables`, []) as SchemaVariable[], variable);
      });
    }

    case SegmentsActions.SEGMENTS_SPACE_UPDATE_VARIABLE: {
      const { variable } = action;

      return produce(state, draft => {
        if (!(segment.schema.variables as SchemaVariable[] | undefined)) {
          set(draft, `${identifier}.schema.variables`, []);
        }

        FlatMap.updateVariable(get(draft, `${identifier}.schema.variables`, []) as SchemaVariable[], variable);
      });
    }

    case SegmentsActions.SEGMENTS_SPACE_REMOVE_VARIABLE: {
      const { name } = action;

      return produce(state, draft => {
        if (!(segment.schema.variables as SchemaVariable[] | undefined)) {
          return;
        }

        FlatMap.removeVariable(get(draft, `${identifier}.schema.variables`, []) as SchemaVariable[], name);
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_ADD_SELECTOR: {
      const { displayMode, selector, selectorType = 'class', path, value, params } = action;

      return produce(state, draft => {
        if (StyleMap.addSelector(draft[identifier].style, displayMode, selector, selectorType, path, value, params)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR: {
      const { displayMode, selector, path, value, params } = action;

      return produce(state, draft => {
        if (StyleMap.updateSelector(draft[identifier].style, displayMode, selector, path, value, params)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTOR: {
      const { displayMode, selector } = action;

      return produce(state, draft => {
        if (StyleMap.removeSelector(draft[identifier].style, displayMode, selector)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTORS: {
      const { displayMode, selectors } = action;

      return produce(state, draft => {
        const removed = selectors.reduce(
          (changed, selector) => StyleMap.removeSelector(draft[identifier].style, displayMode, selector) || changed,
          false
        );
        if (removed) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_ADD_SELECTOR_VARIABLE: {
      const { displayMode, selector, category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.addSelectorVariable(draft[identifier].style, displayMode, selector, category, name, value)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR_VARIABLE: {
      const { displayMode, selector, category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.updateSelectorVariable(draft[identifier].style, displayMode, selector, category, name, value)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTOR_VARIABLE: {
      const { displayMode, selector, category, name } = action;

      return produce(state, draft => {
        if (StyleMap.removeSelectorVariable(draft[identifier].style, displayMode, selector, category, name)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_ADD_VARIABLE: {
      const { category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.addVariable(draft[identifier].style, category, name, value)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_UPDATE_VARIABLE: {
      const { category, name, value } = action;

      return produce(state, draft => {
        if (StyleMap.updateVariable(draft[identifier].style, category, name, value)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_STYLE_REMOVE_VARIABLE: {
      const { category, name } = action;

      return produce(state, draft => {
        if (StyleMap.removeVariable(draft[identifier].style, category, name)) {
          set(draft, `${identifier}.style.cache`, generateCache(draft[identifier].style));
        }
      });
    }

    case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
      const { to, data, dropPosition, initialItems, templatePlatform, variables } = action;
      const newState = produce(state, draft => {
        const segment = draft[identifier] as Segment | undefined;
        if (!segment) {
          return;
        }

        FlatMap.addElement(get(draft, `${identifier}.schema.flat`), data, to, dropPosition, initialItems);
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
