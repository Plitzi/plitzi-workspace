// Packages
import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import useReducerWithMiddleware from '@plitzi/plitzi-ui-components/hooks/useReducerWithMiddleware';

// Monorepo
import useEventBridge from '@repo/event-bridge-shared/hooks/useEventBridge';
import { EventBridgeModuleTypes, EventBridgeTypes } from '@repo/event-bridge-shared/EventBridgeHelper';

// Alias
import FlatMap, { DROP_DIRECTION_INSIDE } from '@pmodules/Schema/helpers/FlatMap';
import { generateCache } from '@pmodules/Style/StyleHelper';
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import { SubscriptionEventTypes } from '@pmodules/Network/helpers/EventTypes';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

// Relatives
import SegmentsContext from './SegmentsContext';
import SegmentsReducer, { SegmentsActions } from './SegmentsReducer';

const SegmentsContextProvider = props => {
  const { children, segments: segmentsProp, includeSubscriptions = true } = props;
  const { query, mutate, subscriptionManager } = useContext(NetworkContext);
  const internalData = useContext(NetworkInternalContext);
  const { enqueueMiddleware } = useContext(QueueContext);
  const { undoableMiddleware } = useContext(UndoableContext);
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
    (segmentId, to, data, dropPosition, initialItems, templatePlatform, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_ADD_TEMPLATE,
        segmentId,
        to,
        data,
        dropPosition,
        initialItems,
        templatePlatform,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  // Schema Actions

  const segmentAddElement = useCallback(
    (segmentId, to, data, dropPosition = DROP_DIRECTION_INSIDE, initialItems = {}, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_ADD_ELEMENT,
        segmentId,
        to,
        data,
        dropPosition,
        initialItems,
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
  //     const elements = FlatMap.clone(flat, elementId, targetId);
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
  //       dropPosition: DROP_DIRECTION_INSIDE,
  //       initialItems: elements.acum,
  //       fromSubscriptions
  //     });
  //   },
  //   [dispatchSegments, SegmentsReducer]
  // );

  const segmentMoveElement = useCallback(
    (segmentId, from, to, elementId, dropPosition = DROP_DIRECTION_INSIDE, fromSubscriptions = false) =>
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
    (segmentId, displayMode, selector, path, value, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_SELECTOR_ADD,
        segmentId,
        displayMode,
        selector,
        path,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentUpdateSelector = useCallback(
    (segmentId, displayMode, selector, path, value, fromSubscriptions = false) =>
      dispatchSegments({
        type: SegmentsActions.SEGMENTS_SELECTOR_UPDATE,
        segmentId,
        displayMode,
        selector,
        path,
        value,
        fromSubscriptions
      }),
    [dispatchSegments]
  );

  const segmentRemoveSelector = useCallback(
    (segmentId, selector, fromSubscriptions = false) =>
      dispatchSegments({ type: SegmentsActions.SEGMENTS_SELECTOR_REMOVE, segmentId, selector, fromSubscriptions }),
    [dispatchSegments]
  );

  const elementAsSegment = useCallback(
    async (flat, style, name, description, element) => {
      const elements = FlatMap.getNested(element.id, flat, element.definition.parentId);
      const elementsStyle = {
        platform: {
          desktop: {},
          tablet: {},
          mobile: {}
        },
        cache: ''
      };

      Object.values(elements.acum).forEach(e => {
        const {
          definition: { styleSelectors }
        } = e;

        Object.values(styleSelectors).forEach(selector => {
          ['desktop', 'tablet', 'mobile'].forEach(mode => {
            if (style.platform[mode][btoa(selector)]) {
              elementsStyle.platform[mode][btoa(selector)] = style.platform[mode][btoa(selector)];
            }
          });
        });
      });

      const result = await mutate('SegmentAdd', {
        name,
        description,
        baseElementId: elements.item.id,
        elements: elements.acum,
        style: {
          ...elementsStyle,
          cache: generateCache(elementsStyle)
        }
      });
      if (result) {
        segmentsAdd(result);
      }
    },
    [segmentsAdd, mutate]
  );

  useEffect(() => {
    if (includeSubscriptions) {
      subscriptionManager.subscribe('SegmentAddElement', SubscriptionEventTypes.SEGMENT_ADD_ELEMENT, {}, data => {
        const { element, to, dropPosition, initialItems = [], contextId } = get(data, 'data.SegmentAddElement', {});
        segmentAddElement(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          true
        );
      });
      subscriptionManager.subscribe('SegmentUpdateElement', SubscriptionEventTypes.SEGMENT_UPDATE_ELEMENT, {}, data => {
        const { element, contextId } = get(data, 'data.SegmentUpdateElement', {});
        segmentUpdateElement(contextId, element, true);
      });
      subscriptionManager.subscribe('SegmentRemoveElement', SubscriptionEventTypes.SEGMENT_REMOVE_ELEMENT, {}, data => {
        const { elementId, contextId } = get(data, 'data.SegmentRemoveElement', {});
        segmentRemoveElement(contextId, elementId, true);
      });
      subscriptionManager.subscribe('SegmentMoveElement', SubscriptionEventTypes.SEGMENT_MOVE_ELEMENT, {}, data => {
        const { from, to, elementId, dropPosition, contextId } = get(data, 'data.SegmentMoveElement', {});
        segmentMoveElement(contextId, from, to, elementId, dropPosition, true);
      });
      subscriptionManager.subscribe('SegmentCloneElement', SubscriptionEventTypes.SEGMENT_CLONE_ELEMENT, {}, data => {
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
      subscriptionManager.subscribe('SegmentAddTemplate', SubscriptionEventTypes.SPACE_ADD_TEMPLATE, {}, data => {
        const {
          element,
          styles,
          to,
          dropPosition,
          initialItems = [],
          contextId
        } = get(data, 'data.SegmentAddTemplate', {});
        segmentAddTemplate(
          contextId,
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          styles,
          true
        );
      });
      subscriptionManager.subscribe(
        'SegmentStyleAddSelector',
        SubscriptionEventTypes.SEGMENT_STYLE_SELECTOR_ADD,
        {},
        data => {
          const { displayMode, selector, path, style, contextId } = get(data, 'data.SegmentStyleAddSelector', {});
          segmentAddSelector(contextId, displayMode, selector, path, style, true);
        }
      );
      subscriptionManager.subscribe(
        'SegmentStyleUpdateSelector',
        SubscriptionEventTypes.SEGMENT_STYLE_SELECTOR_UPDATE,
        {},
        data => {
          const { displayMode, selector, path, style, contextId } = get(data, 'data.SegmentStyleUpdateSelector', {});
          segmentUpdateSelector(contextId, displayMode, selector, path, style, true);
        }
      );
      subscriptionManager.subscribe(
        'SegmentStyleRemoveSelector',
        SubscriptionEventTypes.SEGMENT_STYLE_SELECTOR_REMOVE,
        {},
        data => {
          const { selector, contextId } = get(data, 'data.SegmentStyleRemoveSelector', {});
          segmentRemoveSelector(contextId, btoa(selector), true);
        }
      );
    }
  }, [subscriptionManager, includeSubscriptions]);

  // Mutations

  const segmentAddMutation = useCallback(
    async (name, description, schema, style) => {
      const result = await mutate('SegmentAdd', { name, description, schema, style });
      if (result) {
        segmentsAdd(result);
      }
    },
    [segmentsAdd]
  );

  const events = useMemo(
    () => ({
      [EventBridgeTypes.SCHEMA_UPDATE]: segmentsUpdate,
      [EventBridgeTypes.SCHEMA_ADD_ELEMENT]: segmentAddElement,
      [EventBridgeTypes.SCHEMA_UPDATE_ELEMENT]: segmentUpdateElement,
      [EventBridgeTypes.SCHEMA_REMOVE_ELEMENT]: segmentRemoveElement,
      [EventBridgeTypes.SCHEMA_MOVE_ELEMENT]: segmentMoveElement,
      // [EventBridgeTypes.SCHEMA_CLONE_ELEMENT]: segmentsCloneElement,
      [EventBridgeTypes.SCHEMA_ADD_TEMPLATE]: segmentAddTemplate,
      [EventBridgeTypes.STYLE_UPDATE]: segmentsUpdate,
      [EventBridgeTypes.STYLE_ADD_SELECTOR]: segmentAddSelector,
      [EventBridgeTypes.STYLE_UPDATE_SELECTOR]: segmentUpdateSelector,
      [EventBridgeTypes.STYLE_REMOVE_SELECTOR]: segmentRemoveSelector,
      [EventBridgeTypes.STYLE_ADD_TEMPLATE]: segmentAddTemplate
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
      segmentRemoveSelector
    ]
  );

  useEventBridge(EventBridgeModuleTypes.SEGMENT, events);

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
      elementAsSegment,
      segmentAddMutation
    ]
  );

  return <SegmentsContext.Provider value={segmentsContextValue}>{children}</SegmentsContext.Provider>;
};

SegmentsContextProvider.propTypes = {
  children: PropTypes.node,
  segments: PropTypes.object,
  includeSubscriptions: PropTypes.bool
};

export default SegmentsContextProvider;
