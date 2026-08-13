import { get } from '@plitzi/plitzi-ui/helpers';
import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import { useCallback, use, useEffect, useMemo } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import { useBuilderStoreGetter, useBuilderStoreSync } from '@plitzi/sdk-shared/store';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
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
  StyleVariableValue,
  BuilderQueriesMap,
  BuilderMutationsMap,
  SpaceEventMap,
  StyleCategory,
  StyleState
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

export type SegmentsContextProviderProps = {
  children: ReactNode;
  includeSubscriptions?: boolean;
};

const SegmentsContextProvider = ({ children, includeSubscriptions = true }: SegmentsContextProviderProps) => {
  const { query, mutate, subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap,
    SpaceEventMap
  >;
  const internalData = use(NetworkInternalContext);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  const segmentsPropMemo = useMemo(() => internalData.segments, [internalData.segments]);
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

  useBuilderStoreSync('segments', segments);
  const getSegment = useBuilderStoreGetter('segments');

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
      const segment = getSegment(identifier, undefined);
      if (segment) {
        return segment;
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
    [dispatchSegments, getSegment, query]
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

  const segmentUpdateElements = useCallback(
    (segmentId: string, elements: Element[], fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_UPDATE_ELEMENTS, segmentId, elements, fromSubscriptions }),
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
      path: StyleCategory | undefined,
      value: StyleItem['attributes'] | undefined,
      params: { componentType?: string; styleSelector?: string; styleState?: StyleState; styleVariant?: string },
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
        params,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleUpdateSelector = useCallback(
    (
      segmentId: string,
      displayMode: DisplayMode,
      selector: string,
      path: StyleCategory | undefined,
      value: StyleItem['attributes'] | undefined,
      params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string },
      fromSubscriptions = false
    ) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR,
        segmentId,
        displayMode,
        selector,
        path,
        value,
        params,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleRemoveSelector = useCallback(
    (segmentId: string, displayMode: DisplayMode, selector: string, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTOR,
        segmentId,
        displayMode,
        selector,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentStyleRemoveSelectors = useCallback(
    (segmentId: string, displayMode: DisplayMode, selectors: string[], fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTORS,
        segmentId,
        displayMode,
        selectors,
        fromSubscriptions
      }),
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
    if (!includeSubscriptions) {
      return undefined;
    }

    // Elements
    subscriptionManager.subscribe(
      'SEGMENT_ADD_ELEMENT',
      ({ contextId, element, to, dropPosition, initialItems = [], variables = [] }) =>
        segmentAddElement(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          variables,
          true
        )
    );
    subscriptionManager.subscribe('SEGMENT_UPDATE_ELEMENT', ({ contextId, element }) =>
      segmentUpdateElement(contextId, element, true)
    );
    subscriptionManager.subscribe('SEGMENT_UPDATE_ELEMENTS', ({ contextId, elements }) =>
      segmentUpdateElements(contextId, elements, true)
    );
    subscriptionManager.subscribe('SEGMENT_REMOVE_ELEMENT', ({ contextId, elementId }) =>
      segmentRemoveElement(contextId, elementId, true)
    );
    subscriptionManager.subscribe('SEGMENT_MOVE_ELEMENT', ({ contextId, from, to, elementId, dropPosition }) =>
      segmentMoveElement(contextId, from, to, elementId, dropPosition, true)
    );
    subscriptionManager.subscribe(
      'SEGMENT_CLONE_ELEMENT',
      ({ contextId, element, to, dropPosition, initialItems = [] }) =>
        segmentAddElement(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          [], // @todo: variables
          true
        )
    );
    subscriptionManager.subscribe(
      'SEGMENT_ADD_TEMPLATE',
      ({ contextId, element, style, to, dropPosition, initialItems = [], variables = [] }) =>
        segmentAddTemplate(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          style.platform,
          variables,
          true
        )
    );

    // Space variables
    subscriptionManager.subscribe('SEGMENT_SPACE_ADD_VARIABLE', ({ contextId, variable }) =>
      segmentSpaceAddVariable(contextId, variable, true)
    );
    subscriptionManager.subscribe('SEGMENT_SPACE_UPDATE_VARIABLE', ({ contextId, variable }) =>
      segmentSpaceUpdateVariable(contextId, variable, true)
    );
    subscriptionManager.subscribe('SEGMENT_SPACE_REMOVE_VARIABLE', ({ contextId, variable }) =>
      segmentSpaceRemoveVariable(contextId, variable.name, true)
    );

    // Style selectors
    subscriptionManager.subscribe(
      'SEGMENT_STYLE_ADD_SELECTOR',
      ({ contextId, displayMode, selector, type, path, style, params }) =>
        segmentStyleAddSelector(contextId, displayMode, selector, type, path, style, params, true)
    );
    subscriptionManager.subscribe(
      'SEGMENT_STYLE_UPDATE_SELECTOR',
      ({ contextId, displayMode, selector, path, style, params }) =>
        segmentStyleUpdateSelector(contextId, displayMode, selector, path, style, params, true)
    );
    subscriptionManager.subscribe('SEGMENT_STYLE_REMOVE_SELECTOR', ({ contextId, displayMode, selector }) =>
      segmentStyleRemoveSelector(contextId, displayMode, selector, true)
    );
    subscriptionManager.subscribe('SEGMENT_STYLE_REMOVE_SELECTORS', ({ contextId, displayMode, selectors }) =>
      segmentStyleRemoveSelectors(contextId, displayMode, selectors, true)
    );

    // Style selector variables
    subscriptionManager.subscribe(
      'SEGMENT_STYLE_ADD_SELECTOR_VARIABLE',
      ({ contextId, displayMode, selector, category, name, value }) =>
        segmentStyleAddSelectorVariable(contextId, displayMode, selector, category, name, value, true)
    );
    subscriptionManager.subscribe(
      'SEGMENT_STYLE_UPDATE_SELECTOR_VARIABLE',
      ({ contextId, displayMode, selector, category, name, value }) =>
        segmentStyleUpdateSelectorVariable(contextId, displayMode, selector, category, name, value, true)
    );
    subscriptionManager.subscribe(
      'SEGMENT_STYLE_REMOVE_SELECTOR_VARIABLE',
      ({ contextId, displayMode, selector, category, name }) =>
        segmentStyleRemoveSelectorVariable(contextId, displayMode, selector, category, name, true)
    );

    // Style variables
    subscriptionManager.subscribe('SEGMENT_STYLE_ADD_VARIABLE', ({ contextId, category, name, value }) =>
      segmentStyleAddVariable(contextId, category, name, value, true)
    );
    subscriptionManager.subscribe('SEGMENT_STYLE_UPDATE_VARIABLE', ({ contextId, category, name, value }) =>
      segmentStyleUpdateVariable(contextId, category, name, value, true)
    );
    subscriptionManager.subscribe('SEGMENT_STYLE_REMOVE_VARIABLE', ({ contextId, category, name }) =>
      segmentStyleRemoveVariable(contextId, category, name, true)
    );

    // The cleanup names the events and clears every listener on them: this effect owns them all, and the
    // flag says so out loud rather than leaving it to whichever handler happened to register last.
    return () =>
      subscriptionManager.unsubscribe(
        [
          'SEGMENT_ADD_ELEMENT',
          'SEGMENT_UPDATE_ELEMENT',
          'SEGMENT_UPDATE_ELEMENTS',
          'SEGMENT_REMOVE_ELEMENT',
          'SEGMENT_MOVE_ELEMENT',
          'SEGMENT_CLONE_ELEMENT',
          'SEGMENT_ADD_TEMPLATE',
          'SEGMENT_SPACE_ADD_VARIABLE',
          'SEGMENT_SPACE_UPDATE_VARIABLE',
          'SEGMENT_SPACE_REMOVE_VARIABLE',
          'SEGMENT_STYLE_ADD_SELECTOR',
          'SEGMENT_STYLE_UPDATE_SELECTOR',
          'SEGMENT_STYLE_REMOVE_SELECTOR',
          'SEGMENT_STYLE_REMOVE_SELECTORS',
          'SEGMENT_STYLE_ADD_SELECTOR_VARIABLE',
          'SEGMENT_STYLE_UPDATE_SELECTOR_VARIABLE',
          'SEGMENT_STYLE_REMOVE_SELECTOR_VARIABLE',
          'SEGMENT_STYLE_ADD_VARIABLE',
          'SEGMENT_STYLE_UPDATE_VARIABLE',
          'SEGMENT_STYLE_REMOVE_VARIABLE'
        ],
        true
      );
  }, [
    subscriptionManager,
    includeSubscriptions,
    segmentAddElement,
    segmentUpdateElement,
    segmentUpdateElements,
    segmentRemoveElement,
    segmentMoveElement,
    segmentAddTemplate,
    segmentSpaceAddVariable,
    segmentSpaceUpdateVariable,
    segmentSpaceRemoveVariable,
    segmentStyleAddSelector,
    segmentStyleUpdateSelector,
    segmentStyleRemoveSelector,
    segmentStyleRemoveSelectors,
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
      schemaUpdateElements: segmentUpdateElements,
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
      styleRemoveSelectors: segmentStyleRemoveSelectors,
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
      segmentUpdateElements,
      segmentRemoveElement,
      segmentMoveElement,
      segmentAddTemplate,
      segmentSpaceAddVariable,
      segmentSpaceUpdateVariable,
      segmentSpaceRemoveVariable,
      segmentStyleAddSelector,
      segmentStyleUpdateSelector,
      segmentStyleRemoveSelector,
      segmentStyleRemoveSelectors,
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
      dispatchSegments,
      segmentGet,
      segmentsFetch,
      segmentsAdd,
      segmentsUpdate,
      segmentsRemove,
      elementAsSegment,
      segmentAddMutation
    }),
    [
      dispatchSegments,
      segmentGet,
      segmentsFetch,
      segmentsAdd,
      segmentsUpdate,
      segmentsRemove,
      elementAsSegment,
      segmentAddMutation
    ]
  );

  return <SegmentsContext value={segmentsContextValue}>{children}</SegmentsContext>;
};

export default SegmentsContextProvider;
