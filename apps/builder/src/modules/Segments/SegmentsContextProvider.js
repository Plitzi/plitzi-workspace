// Packages
import React, { useCallback, use, useEffect, useMemo, useRef } from 'react';
import get from 'lodash/get';
import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';

// Monorepo
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

// Relatives
import SegmentsContext from './SegmentsContext';
import SegmentsReducer, { SegmentsActions } from './SegmentsReducer';

/**
 * @param {{
 *   children: React.ReactNode;
 *   segments?: object;
 *   includeSubscriptions?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const SegmentsContextProvider = props => {
  const { children, segments: segmentsProp, includeSubscriptions = true } = props;
  const { query, mutate, subscriptionManager } = use(NetworkContext);
  const internalData = use(NetworkInternalContext);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  const segmentsPropMemo = useMemo(() => {
    if (segmentsProp) {
      return segmentsProp;
    }

    return internalData.segments ?? {};
  }, [segmentsProp]);
  const middlewareMemo = useMemo(
    () => [
      { middleware: undoableMiddleware, filterCallback: action => !action.fromSubscriptions },
      { middleware: enqueueMiddleware, filterCallback: action => !action.fromSubscriptions }
    ],
    [undoableMiddleware]
  );
  const [segments, dispatchSegments] = useReducerWithMiddleware(SegmentsReducer, segmentsPropMemo, middlewareMemo);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const segmentsFetch = useCallback(
    async (filter, cursor, limit) => {
      const result = await query('Segments', { environment: 'main', filter, cursor, limit }, 'network-only');

      return result;
    },
    [query]
  );

  const segmentGet = useCallback(
    async identifier => {
      if (segmentsRef.current[identifier]) {
        return segmentsRef.current[identifier];
      }

      let segment = await query('Segment', { environment: 'main', identifier }, 'network-only');
      if (segment) {
        segment = {
          ...segment,
          schema: {
            ...get(segment, 'schema'),
            flat: get(segment, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
          }
        };

        dispatchSegments({ type: SegmentsActions.SEGMENTS_ADD, segment, fromSubscriptions: true });
      }

      return segment;
    },
    [query]
  );

  const segmentsAdd = useCallback(
    segment => {
      if (Array.isArray(get(segment, 'schema.flat', []))) {
        segment = {
          ...segment,
          schema: {
            ...get(segment, 'schema'),
            flat: get(segment, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
          }
        };
      }

      dispatchSegments({ type: SegmentsActions.SEGMENTS_ADD, segment });
    },
    [dispatchSegments]
  );

  const segmentsUpdate = useCallback(
    segment => dispatchSegments({ type: SegmentsActions.SEGMENTS_UPDATE, segment }),
    [dispatchSegments]
  );

  const segmentsRemove = useCallback(
    segmentId => dispatchSegments({ type: SegmentsActions.SEGMENTS_REMOVE, segmentId }),
    [dispatchSegments]
  );

  // General Actions

  const segmentAddTemplate = useCallback(
    (segmentId, to, data, dropPosition, initialItems, templatePlatform, variables, fromSubscriptions = false) => {
      return dispatchSegments({
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
    (segmentId, to, data, dropPosition = 'inside', initialItems = {}, variables = [], fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_ADD_ELEMENT,
        segmentId,
        to,
        data,
        dropPosition,
        initialItems,
        variables,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentUpdateElement = useCallback(
    (segmentId, element, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_UPDATE_ELEMENT, segmentId, element, fromSubscriptions }),
    [dispatchSegments]
  );

  const segmentRemoveElement = useCallback(
    (segmentId, elementId, fromSubscriptions = false) =>
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
    (segmentId, from, to, elementId, dropPosition = 'inside', fromSubscriptions = false) =>
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

  // Style Actions

  const segmentAddSelector = useCallback(
    (segmentId, displayMode, selector, type, path, value, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_ADD_SELECTOR,
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

  const segmentUpdateSelector = useCallback(
    (segmentId, displayMode, selector, type, path, value, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_UPDATE_SELECTOR,
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

  const segmentRemoveSelector = useCallback(
    (segmentId, selector, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_REMOVE_SELECTOR, segmentId, selector, fromSubscriptions }),
    [dispatchSegments]
  );

  const segmentAddVariable = useCallback(
    (segmentId, variable, value, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_ADD_VARIABLE, segmentId, variable, value, fromSubscriptions }),
    [dispatchSegments]
  );

  const segmentUpdateVariable = useCallback(
    (segmentId, variable, value, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_UPDATE_VARIABLE,
        segmentId,
        variable,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentRemoveVariable = useCallback(
    (segmentId, variable, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_REMOVE_VARIABLE, segmentId, variable, fromSubscriptions }),
    [dispatchSegments]
  );

  const elementAsSegment = useCallback(
    async (schema, style, name, description, element) => {
      if (!element) {
        return;
      }

      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(schema, style, element.id);
      const result = await mutate('SegmentAdd', {
        name,
        description,
        baseElementId: elements.item.id,
        elements: elements.acum,
        style: { ...elementsStyle, cache: generateCache(elementsStyle) },
        variables
      });
      if (result) {
        segmentsAdd(result);
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
        } = get(data, 'data.SegmentAddElement', {});
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
        const { element, contextId } = get(data, 'data.SegmentUpdateElement', {});
        segmentUpdateElement(contextId, element, true);
      });
      subscriptionManager.subscribe('SegmentRemoveElement', {}, data => {
        const { elementId, contextId } = get(data, 'data.SegmentRemoveElement', {});
        segmentRemoveElement(contextId, elementId, true);
      });
      subscriptionManager.subscribe('SegmentMoveElement', {}, data => {
        const { from, to, elementId, dropPosition, contextId } = get(data, 'data.SegmentMoveElement', {});
        segmentMoveElement(contextId, from, to, elementId, dropPosition, true);
      });
      subscriptionManager.subscribe('SegmentCloneElement', {}, data => {
        const { element, to, dropPosition, initialItems = [], contextId } = get(data, 'data.SegmentCloneElement', {});
        segmentAddElement(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
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
        } = get(data, 'data.SegmentAddTemplate', {});
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
      subscriptionManager.subscribe('SegmentStyleAddSelector', {}, data => {
        const { displayMode, selector, type, path, style, contextId } = get(data, 'data.SegmentStyleAddSelector', {});
        segmentAddSelector(contextId, displayMode, selector, type, path, style, true);
      });
      subscriptionManager.subscribe('SegmentStyleUpdateSelector', {}, data => {
        const { displayMode, selector, type, path, style, contextId } = get(
          data,
          'data.SegmentStyleUpdateSelector',
          {}
        );
        segmentUpdateSelector(contextId, displayMode, selector, type, path, style, true);
      });
      subscriptionManager.subscribe('SegmentStyleRemoveSelector', {}, data => {
        const { selector, contextId } = get(data, 'data.SegmentStyleRemoveSelector', {});
        segmentRemoveSelector(contextId, selector, true);
      });

      subscriptionManager.subscribe('SegmentStyleAddVariable', {}, data => {
        const { variable, value, contextId } = get(data, 'data.SegmentStyleAddVariable', {});
        segmentAddVariable(contextId, variable, value, true);
      });
      subscriptionManager.subscribe('SegmentStyleUpdateVariable', {}, data => {
        const { variable, value, contextId } = get(data, 'data.SegmentStyleUpdateVariable', {});
        segmentUpdateVariable(contextId, variable, value, true);
      });
      subscriptionManager.subscribe('SegmentStyleRemoveVariable', {}, data => {
        const { variable, contextId } = get(data, 'data.SegmentStyleRemoveVariable', {});
        segmentRemoveVariable(contextId, variable, true);
      });
    }
  }, [subscriptionManager, includeSubscriptions]);

  // Mutations

  const segmentAddMutation = useCallback(
    async (name, description, schema, style, variables = []) => {
      const result = await mutate('SegmentAdd', { name, description, schema, style, variables });
      if (result) {
        segmentsAdd(result);
      }
    },
    [segmentsAdd]
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
      styleAddSelector: segmentAddSelector,
      styleUpdateSelector: segmentUpdateSelector,
      styleRemoveSelector: segmentRemoveSelector,
      styleAddVariable: segmentAddVariable,
      styleUpdateVariable: segmentUpdateVariable,
      styleRemoveVariable: segmentRemoveVariable,
      styleAddTemplate: segmentAddTemplate
    }),
    [
      segmentsAdd,
      segmentsUpdate,
      segmentsRemove,
      segmentAddElement,
      segmentUpdateElement,
      segmentMoveElement,
      segmentRemoveElement,
      segmentAddSelector,
      segmentUpdateSelector,
      segmentRemoveSelector,
      segmentAddVariable,
      segmentUpdateVariable,
      segmentRemoveVariable
    ]
  );

  useEventBridge('segment', events);

  const segmentsContextValue = useMemo(
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
      segmentAddSelector,
      segmentUpdateSelector,
      segmentRemoveSelector,
      segmentAddVariable,
      segmentUpdateVariable,
      segmentRemoveVariable,
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
      segmentAddSelector,
      segmentUpdateSelector,
      segmentRemoveSelector,
      segmentAddVariable,
      segmentUpdateVariable,
      segmentRemoveVariable,
      segmentAddTemplate,
      elementAsSegment,
      segmentAddMutation
    ]
  );

  return <SegmentsContext value={segmentsContextValue}>{children}</SegmentsContext>;
};

export default SegmentsContextProvider;
