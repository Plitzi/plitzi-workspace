import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import get from 'lodash-es/get';
import { useCallback, use, useEffect, useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import SegmentsReducer, { SegmentsActions } from './SegmentsReducer';

import type { SegmentsReducerActions } from './SegmentsReducer';
import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type {
  SchemaVariable,
  Segment,
  SegmentRaw,
  DropPosition,
  Style,
  Element,
  Schema,
  DisplayMode,
  TagType,
  StyleItem,
  SegmentsContextValue,
  StyleVariableCategory,
  StyleVariableValue
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { SubscriptionsMap } from '@pmodules/Network/Subscriptions';
import type { ReactNode } from 'react';

export type SegmentsContextProviderProps = {
  children: ReactNode;
  segments?: Record<string, Segment>;
  includeSubscriptions?: boolean;
};

const SegmentsContextProvider = ({
  children,
  segments: segmentsProp,
  includeSubscriptions = true
}: SegmentsContextProviderProps) => {
  const { query, mutate, subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue<
    QueriesMap,
    MutationsMap,
    SubscriptionsMap
  >;
  const internalData = use(NetworkInternalContext);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  const segmentsPropMemo = useMemo(() => {
    if (segmentsProp) {
      return segmentsProp;
    }

    return internalData.segments;
  }, [internalData.segments, segmentsProp]);
  const [segments, dispatchSegments] = useReducerWithMiddleware(SegmentsReducer, segmentsPropMemo, [
    {
      middleware: undoableMiddleware as ReducerMiddlewareCallback<
        Record<string, Segment>,
        [action: SegmentsReducerActions]
      >,
      filterCallback: action => !action.fromSubscriptions
    },
    {
      middleware: enqueueMiddleware as ReducerMiddlewareCallback<
        Record<string, Segment>,
        [action: SegmentsReducerActions]
      >,
      filterCallback: action => !action.fromSubscriptions
    }
  ]);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const segmentsFetch = useCallback(
    async (filter?: string | object, cursor?: string, limit?: number) => {
      try {
        const response = await query('Segments', { environment: 'main', filter, cursor, limit }, 'network-only');
        if (!response.result) {
          return undefined;
        }

        const segmentsRaw = response.result.Segments;

        return {
          ...segmentsRaw,
          edges: segmentsRaw.edges.map<Segment>((segmentRaw: SegmentRaw) => ({
            ...segmentRaw,
            schema: {
              ...get(segmentRaw, 'schema'),
              flat: get(segmentRaw, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
            }
          }))
        };
      } catch {
        return undefined;
      }
    },
    [query]
  );

  const segmentGet = useCallback(
    async (identifier: string) => {
      if (segmentsRef.current[identifier as keyof typeof segmentsRef.current] as Segment | undefined) {
        return segmentsRef.current[identifier as keyof typeof segmentsRef.current] as Segment;
      }

      try {
        const response = await query('Segment', { environment: 'main', identifier }, 'network-only');
        if (!response.result) {
          return undefined;
        }

        const segmentRaw = response.result.Segment;
        const segment: Segment = {
          ...segmentRaw,
          schema: {
            ...get(segmentRaw, 'schema'),
            flat: get(segmentRaw, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
          }
        };

        // as subscription (to populate the reducer)
        dispatchSegments({
          type: SegmentsActions.SEGMENTS_ADD,
          segmentId: segment.id,
          segment,
          fromSubscriptions: true
        });

        return segment;
      } catch {
        return undefined;
      }
    },
    [dispatchSegments, query]
  );

  const segmentsAdd = useCallback(
    (segment: Segment) => {
      dispatchSegments({ type: SegmentsActions.SEGMENTS_ADD, segment, segmentId: segment.id });
    },
    [dispatchSegments]
  );

  const segmentsUpdate = useCallback(
    (segment: Segment) => dispatchSegments({ type: SegmentsActions.SEGMENTS_UPDATE, segment, segmentId: segment.id }),
    [dispatchSegments]
  );

  const segmentsRemove = useCallback(
    (segmentId: string) => dispatchSegments({ type: SegmentsActions.SEGMENTS_REMOVE, segmentId }),
    [dispatchSegments]
  );

  // General Actions

  const segmentAddTemplate = useCallback(
    (
      segmentId: string,
      to: string,
      data: Element,
      dropPosition: DropPosition,
      initialItems: Record<string, Element>,
      templatePlatform: Style['platform'],
      variables: SchemaVariable[],
      fromSubscriptions = false
    ) => {
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_ADD_TEMPLATE,
        segmentId,
        to,
        data,
        dropPosition,
        initialItems,
        templatePlatform,
        variables,
        fromSubscriptions
      });
    },
    [dispatchSegments]
  );

  // Schema Actions

  const segmentAddElement = useCallback(
    (
      segmentId: string,
      to: string,
      data: Element,
      dropPosition: DropPosition = 'inside',
      initialItems: Record<string, Element> = {},
      variables: SchemaVariable[] = [],
      fromSubscriptions = false
    ) => {
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_ADD_ELEMENT,
        segmentId,
        to,
        data,
        dropPosition,
        initialItems,
        variables,
        fromSubscriptions
      });
    },
    [dispatchSegments]
  );

  const segmentUpdateElement = useCallback(
    (segmentId: string, element: Element, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_UPDATE_ELEMENT, segmentId, element, fromSubscriptions }),
    [dispatchSegments]
  );

  const segmentRemoveElement = useCallback(
    (segmentId: string, elementId: string, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_REMOVE_ELEMENT, segmentId, elementId, fromSubscriptions }),
    [dispatchSegments]
  );

  // const segmentCloneElement = useCallback(
  //   (segmentId, elementId, targetId, fromSubscriptions = false) => {
  //     const flat = get(getState(), `${segmentId}.schema.flat`);
  //     const elements = FlatMap.cloneElements(flat, elementId, targetId);
  //     if (!elements || !elements.item) {
  //       return null;
  //     }

  //     if (elements.acum[elements.item.id]) {
  //       delete elements.acum[elements.item.id];
  //     }

  //     return dispatch({
  //       type: SegmentsActions.SEGMENTS_CLONE_ELEMENT,
  //       segmentId,
  //       to: targetId ?? get(elements, 'item.definition.parentId'),
  //       data: elements.item,
  //       dropPosition: 'inside',
  //       initialItems: elements.acum,
  //       fromSubscriptions
  //     });
  //   },
  //   [dispatchSegments, SegmentsReducer]
  // );

  const segmentMoveElement = useCallback(
    (
      segmentId: string,
      from: string,
      to: string,
      elementId: string,
      dropPosition: DropPosition = 'inside',
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_MOVE_ELEMENT,
        segmentId,
        from,
        to,
        elementId,
        dropPosition,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentSpaceAddVariable = useCallback(
    (segmentId: string, variable: SchemaVariable, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_SPACE_ADD_VARIABLE, segmentId, variable, fromSubscriptions }),
    [dispatchSegments]
  );

  const segmentSpaceUpdateVariable = useCallback(
    (segmentId: string, variable: SchemaVariable, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_SPACE_UPDATE_VARIABLE,
        segmentId,
        variable,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentSpaceRemoveVariable = useCallback(
    (segmentId: string, name: string, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_SPACE_REMOVE_VARIABLE, segmentId, name, fromSubscriptions }),
    [dispatchSegments]
  );

  // Style Actions

  const segmentStyleAddSelector = useCallback(
    (
      segmentId: string,
      displayMode: DisplayMode,
      selector: string,
      type: TagType,
      path: string,
      value?: StyleItem['attributes'],
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_ADD_SELECTOR,
        segmentId,
        displayMode,
        selector,
        selectorType: type,
        path,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleUpdateSelector = useCallback(
    (
      segmentId: string,
      displayMode: DisplayMode,
      selector: string,
      type: TagType,
      path: string,
      value?: StyleItem['attributes'],
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR,
        segmentId,
        displayMode,
        selector,
        selectorType: type,
        path,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleRemoveSelector = useCallback(
    (segmentId: string, selector: string, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_REMOVE_SELECTOR, segmentId, selector, fromSubscriptions }),
    [dispatchSegments]
  );

  const segmentStyleAddSelectorVariable = useCallback(
    (
      segmentId: string,
      displayMode: DisplayMode,
      selector: string,
      category: StyleVariableCategory,
      name: string,
      value: StyleVariableValue,
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_ADD_SELECTOR_VARIABLE,
        segmentId,
        displayMode,
        selector,
        category,
        name,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleUpdateSelectorVariable = useCallback(
    (
      segmentId: string,
      displayMode: DisplayMode,
      selector: string,
      category: StyleVariableCategory,
      name: string,
      value: StyleVariableValue,
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR_VARIABLE,
        segmentId,
        displayMode,
        selector,
        category,
        name,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleRemoveSelectorVariable = useCallback(
    (
      segmentId: string,
      displayMode: DisplayMode,
      selector: string,
      category: StyleVariableCategory,
      name: string,
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTOR_VARIABLE,
        segmentId,
        displayMode,
        selector,
        category,
        name,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleAddVariable = useCallback(
    (
      segmentId: string,
      category: StyleVariableCategory,
      name: string,
      value: StyleVariableValue,
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_ADD_VARIABLE,
        segmentId,
        category,
        name,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleUpdateVariable = useCallback(
    (
      segmentId: string,
      category: StyleVariableCategory,
      name: string,
      value: StyleVariableValue,
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_UPDATE_VARIABLE,
        segmentId,
        category,
        name,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleRemoveVariable = useCallback(
    (segmentId: string, category: StyleVariableCategory, name: string, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_REMOVE_VARIABLE,
        segmentId,
        category,
        name,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const elementAsSegment = useCallback(
    async (schema: Schema, style: Style, name: string, description: string, element: Element) => {
      if (!(element as Element | undefined)) {
        return;
      }

      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(schema, style, element.id);
      if (!elements.item) {
        return;
      }

      const response = await mutate('SegmentAdd', {
        name,
        description,
        baseElementId: elements.item.id,
        elements: elements.acum,
        style: { ...elementsStyle, cache: generateCache(elementsStyle) },
        variables
      });
      if (response.result) {
        const segment: Segment = {
          ...response.result,
          schema: {
            ...get(response.result, 'schema'),
            flat: get(response.result, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
          }
        };

        segmentsAdd(segment);
      }
    },
    [segmentsAdd, mutate]
  );

  useEffect(() => {
    if (includeSubscriptions) {
      subscriptionManager.subscribe('SegmentAddElement', {}, data => {
        const {
          element,
          to,
          dropPosition,
          initialItems = [],
          variables = [],
          contextId
        } = get(data, 'data.SegmentAddElement', {}) as {
          to: string;
          element: Element;
          dropPosition: DropPosition;
          initialItems: Element[];
          templatePlatform: Style['platform'];
          variables: SchemaVariable[];
          contextId: string;
        };
        segmentAddElement(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          variables,
          true
        );
      });
      subscriptionManager.subscribe('SegmentUpdateElement', {}, data => {
        const { element, contextId } = get(data, 'data.SegmentUpdateElement', {}) as {
          element: Element;
          contextId: string;
        };
        segmentUpdateElement(contextId, element, true);
      });
      subscriptionManager.subscribe('SegmentRemoveElement', {}, data => {
        const { elementId, contextId } = get(data, 'data.SegmentRemoveElement', {}) as {
          elementId: string;
          contextId: string;
        };
        segmentRemoveElement(contextId, elementId, true);
      });
      subscriptionManager.subscribe('SegmentMoveElement', {}, data => {
        const { from, to, elementId, dropPosition, contextId } = get(data, 'data.SegmentMoveElement', {}) as {
          from: string;
          to: string;
          elementId: string;
          dropPosition: DropPosition;
          contextId: string;
        };
        segmentMoveElement(contextId, from, to, elementId, dropPosition, true);
      });
      subscriptionManager.subscribe('SegmentCloneElement', {}, data => {
        const {
          element,
          to,
          dropPosition,
          initialItems = [],
          contextId
        } = get(data, 'data.SegmentCloneElement', {}) as {
          element: Element;
          to: string;
          dropPosition: DropPosition;
          initialItems: Element[];
          contextId: string;
        };
        segmentAddElement(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          [], // @todo: variables
          true
        );
      });
      subscriptionManager.subscribe('SegmentAddTemplate', {}, data => {
        const {
          element,
          styles,
          to,
          dropPosition,
          initialItems = [],
          variables = [],
          contextId
        } = get(data, 'data.SegmentAddTemplate', {}) as {
          element: Element;
          styles: Style['platform'];
          to: string;
          dropPosition: DropPosition;
          initialItems: Element[];
          variables: SchemaVariable[];
          contextId: string;
        };
        segmentAddTemplate(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          styles,
          variables,
          true
        );
      });

      subscriptionManager.subscribe('SegmentSpaceAddVariable', {}, data => {
        const { contextId, variable } = get(
          data,
          'data.SegmentSpaceAddVariable',
          {}
        ) as SubscriptionsMap['SegmentSpaceAddVariable'];
        segmentSpaceAddVariable(contextId, variable, true);
      });

      subscriptionManager.subscribe('SegmentSpaceUpdateVariable', {}, data => {
        const { contextId, variable } = get(
          data,
          'data.SegmentSpaceUpdateVariable',
          {}
        ) as SubscriptionsMap['SegmentSpaceUpdateVariable'];
        segmentSpaceUpdateVariable(contextId, variable, true);
      });

      subscriptionManager.subscribe('SegmentSpaceRemoveVariable', {}, data => {
        const { contextId, variable } = get(
          data,
          'data.SegmentSpaceRemoveVariable',
          {}
        ) as SubscriptionsMap['SegmentSpaceRemoveVariable'];
        segmentSpaceRemoveVariable(contextId, variable.name, true);
      });

      subscriptionManager.subscribe('SegmentStyleAddSelector', {}, data => {
        const { displayMode, selector, type, path, style, contextId } = get(
          data,
          'data.SegmentStyleAddSelector',
          {}
        ) as SubscriptionsMap['SegmentStyleAddSelector'];
        segmentStyleAddSelector(contextId, displayMode, selector, type, path, style, true);
      });
      subscriptionManager.subscribe('SegmentStyleUpdateSelector', {}, data => {
        const { displayMode, selector, type, path, style, contextId } = get(
          data,
          'data.SegmentStyleUpdateSelector',
          {}
        ) as {
          displayMode: DisplayMode;
          selector: string;
          path: string;
          type: TagType;
          style: StyleItem['attributes'];
          contextId: string;
        };
        segmentStyleUpdateSelector(contextId, displayMode, selector, type, path, style, true);
      });
      subscriptionManager.subscribe('SegmentStyleRemoveSelector', {}, data => {
        const { selector, contextId } = get(data, 'data.SegmentStyleRemoveSelector', {}) as {
          selector: string;
          contextId: string;
        };
        segmentStyleRemoveSelector(contextId, selector, true);
      });

      subscriptionManager.subscribe('SegmentStyleAddSelectorVariable', {}, data => {
        const { contextId, displayMode, selector, category, name, value } = get(
          data,
          'data.SegmentStyleAddSelectorVariable',
          {}
        ) as SubscriptionsMap['SegmentStyleAddSelectorVariable'];
        segmentStyleAddSelectorVariable(contextId, displayMode, selector, category, name, value, true);
      });
      subscriptionManager.subscribe('SegmentStyleUpdateSelectorVariable', {}, data => {
        const { contextId, displayMode, selector, category, name, value } = get(
          data,
          'data.SegmentStyleUpdateSelectorVariable',
          {}
        ) as SubscriptionsMap['SegmentStyleUpdateSelectorVariable'];
        segmentStyleUpdateSelectorVariable(contextId, displayMode, selector, category, name, value, true);
      });
      subscriptionManager.subscribe('SegmentStyleRemoveSelectorVariable', {}, data => {
        const { contextId, displayMode, selector, category, name } = get(
          data,
          'data.SegmentStyleRemoveSelectorVariable',
          {}
        ) as SubscriptionsMap['SegmentStyleRemoveSelectorVariable'];
        segmentStyleRemoveSelectorVariable(contextId, displayMode, selector, category, name, true);
      });

      subscriptionManager.subscribe('SegmentStyleAddVariable', {}, data => {
        const { category, name, value, contextId } = get(
          data,
          'data.SegmentStyleAddVariable',
          {}
        ) as SubscriptionsMap['SegmentStyleAddVariable'];
        segmentStyleAddVariable(contextId, category, name, value, true);
      });
      subscriptionManager.subscribe('SegmentStyleUpdateVariable', {}, data => {
        const { category, name, value, contextId } = get(
          data,
          'data.SegmentStyleUpdateVariable',
          {}
        ) as SubscriptionsMap['SegmentStyleUpdateVariable'];
        segmentStyleUpdateVariable(contextId, category, name, value, true);
      });
      subscriptionManager.subscribe('SegmentStyleRemoveVariable', {}, data => {
        const { category, name, contextId } = get(
          data,
          'data.SegmentStyleRemoveVariable',
          {}
        ) as SubscriptionsMap['SegmentStyleRemoveVariable'];
        segmentStyleRemoveVariable(contextId, category, name, true);
      });
    }

    return () => {
      subscriptionManager.unsubscribe([
        'SegmentAddElement',
        'SegmentUpdateElement',
        'SegmentRemoveElement',
        'SegmentMoveElement',
        'SegmentCloneElement',
        'SegmentAddTemplate',
        'SegmentSpaceAddVariable',
        'SegmentSpaceUpdateVariable',
        'SegmentSpaceRemoveVariable',
        'SegmentStyleAddSelector',
        'SegmentStyleUpdateSelector',
        'SegmentStyleRemoveSelector',
        'SegmentStyleAddSelectorVariable',
        'SegmentStyleUpdateSelectorVariable',
        'SegmentStyleRemoveSelectorVariable',
        'SegmentStyleAddVariable',
        'SegmentStyleUpdateVariable',
        'SegmentStyleRemoveVariable'
      ]);
    };
  }, [
    subscriptionManager,
    includeSubscriptions,
    segmentAddElement,
    segmentUpdateElement,
    segmentRemoveElement,
    segmentMoveElement,
    segmentAddTemplate,
    segmentSpaceAddVariable,
    segmentSpaceUpdateVariable,
    segmentSpaceRemoveVariable,
    segmentStyleAddSelector,
    segmentStyleUpdateSelector,
    segmentStyleRemoveSelector,
    segmentStyleAddSelectorVariable,
    segmentStyleUpdateSelectorVariable,
    segmentStyleRemoveSelectorVariable,
    segmentStyleAddVariable,
    segmentStyleUpdateVariable,
    segmentStyleRemoveVariable
  ]);

  // Mutations

  const segmentAddMutation = useCallback(
    async (name: string, description: string, schema?: Schema, style?: Style, variables: SchemaVariable[] = []) => {
      const response = await mutate('SegmentAdd', { name, description, schema, style, variables });
      if (response.result) {
        const segment: Segment = {
          ...response.result,
          schema: {
            ...get(response.result, 'schema'),
            flat: get(response.result, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
          }
        };

        segmentsAdd(segment);
      }
    },
    [mutate, segmentsAdd]
  );

  const events = useMemo(
    () => ({
      schemaUpdate: segmentsUpdate,
      schemaAddElement: segmentAddElement,
      schemaUpdateElement: segmentUpdateElement,
      schemaRemoveElement: segmentRemoveElement,
      schemaMoveElement: segmentMoveElement,
      // schemaCloneElement: segmentsCloneElement,
      schemaAddTemplate: segmentAddTemplate,
      styleUpdate: segmentsUpdate,
      spaceAddVariable: segmentSpaceAddVariable,
      spaceUpdateVariable: segmentSpaceUpdateVariable,
      spaceRemoveVariable: segmentSpaceRemoveVariable,
      styleAddSelector: segmentStyleAddSelector,
      styleUpdateSelector: segmentStyleUpdateSelector,
      styleRemoveSelector: segmentStyleRemoveSelector,
      styleAddSelectorVariable: segmentStyleAddSelectorVariable,
      styleUpdateSelectorVariable: segmentStyleUpdateSelectorVariable,
      styleRemoveSelectorVariable: segmentStyleRemoveSelectorVariable,
      styleAddVariable: segmentStyleAddVariable,
      styleUpdateVariable: segmentStyleUpdateVariable,
      styleRemoveVariable: segmentStyleRemoveVariable,
      styleAddTemplate: segmentAddTemplate
    }),
    [
      segmentsUpdate,
      segmentAddElement,
      segmentUpdateElement,
      segmentRemoveElement,
      segmentMoveElement,
      segmentAddTemplate,
      segmentSpaceAddVariable,
      segmentSpaceUpdateVariable,
      segmentSpaceRemoveVariable,
      segmentStyleAddSelector,
      segmentStyleUpdateSelector,
      segmentStyleRemoveSelector,
      segmentStyleAddSelectorVariable,
      segmentStyleUpdateSelectorVariable,
      segmentStyleRemoveSelectorVariable,
      segmentStyleAddVariable,
      segmentStyleUpdateVariable,
      segmentStyleRemoveVariable
    ]
  );

  useEventBridge('segment', events);

  const segmentsContextValue = useMemo<SegmentsContextValue<'builder'>>(
    () => ({
      segments,
      dispatchSegments,
      segmentGet,
      segmentsFetch,
      segmentsAdd,
      segmentsUpdate,
      segmentsRemove,
      segmentAddElement,
      segmentUpdateElement,
      segmentMoveElement,
      segmentRemoveElement,
      segmentSpaceAddVariable,
      segmentSpaceUpdateVariable,
      segmentSpaceRemoveVariable,
      segmentStyleAddSelector,
      segmentStyleUpdateSelector,
      segmentStyleRemoveSelector,
      segmentStyleAddSelectorVariable,
      segmentStyleUpdateSelectorVariable,
      segmentStyleRemoveSelectorVariable,
      segmentStyleAddVariable,
      segmentStyleUpdateVariable,
      segmentStyleRemoveVariable,
      segmentAddTemplate,
      elementAsSegment,
      segmentAddMutation
    }),
    [
      segments,
      dispatchSegments,
      segmentGet,
      segmentsFetch,
      segmentsAdd,
      segmentsUpdate,
      segmentsRemove,
      segmentAddElement,
      segmentUpdateElement,
      segmentMoveElement,
      segmentRemoveElement,
      segmentSpaceAddVariable,
      segmentSpaceUpdateVariable,
      segmentSpaceRemoveVariable,
      segmentStyleAddSelector,
      segmentStyleUpdateSelector,
      segmentStyleRemoveSelector,
      segmentStyleAddSelectorVariable,
      segmentStyleUpdateSelectorVariable,
      segmentStyleRemoveSelectorVariable,
      segmentStyleAddVariable,
      segmentStyleUpdateVariable,
      segmentStyleRemoveVariable,
      segmentAddTemplate,
      elementAsSegment,
      segmentAddMutation
    ]
  );

  return <SegmentsContext value={segmentsContextValue}>{children}</SegmentsContext>;
};

export default SegmentsContextProvider;
