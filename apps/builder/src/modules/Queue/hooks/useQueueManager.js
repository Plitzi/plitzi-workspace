// Packages
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Alias
import { StyleActions } from '@pmodules/Style/StyleReducer';
import { SchemaActions } from '@pmodules/Schema/SchemaReducer';
import { SegmentsActions } from '@pmodules/Segments/SegmentsReducer';

// Relatives
import { delay as delayFunction } from '../../../helpers/utils';

const useQueueManager = (props = {}) => {
  const { delay = 1000, mutate = noop, maxRetries = 2, retryTimeout = 2500 } = props;
  const queues = useMemo(() => ({ queueNormal: [], queueUrgent: [] }), []);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(processing);
  processingRef.current = processing;

  const parseItem = useCallback(rawItem => {
    const { action } = rawItem;

    return { type: action.type, data: omit(action, ['type']) };
  }, []);

  const processItem = useCallback(
    async item => {
      const itemParsed = parseItem(item);
      switch (itemParsed.type) {
        // Schema

        case SchemaActions.SCHEMA_ADD_PAGE: {
          return null; // managed in the provider due that we need the ID from the server
        }

        case SchemaActions.SCHEMA_HOME_PAGE: {
          const { pageId } = itemParsed.data;
          const {
            prevState: { flat }
          } = item;
          const page = flat[pageId];
          if (!page) {
            return null;
          }

          const defaultPage = get(page, 'attributes.default', false);
          if (defaultPage) {
            return null;
          }

          return mutate('SpaceHomePage', { pageId });
        }

        case SchemaActions.SCHEMA_UPDATE_PAGE: {
          const { page } = itemParsed.data;

          return mutate('SpaceUpdatePage', { page });
        }

        case SchemaActions.SCHEMA_REMOVE_PAGE: {
          const { pageId } = itemParsed.data;

          return mutate('SpaceRemovePage', { pageId });
        }

        case SchemaActions.SCHEMA_ADD_PAGE_FOLDER: {
          return null; // managed in the provider due that we need the ID from the server
        }

        case SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER: {
          const { pageFolder } = itemParsed.data;

          return mutate('SpaceUpdatePageFolder', { pageFolder });
        }

        case SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER: {
          const { pageFolderId } = itemParsed.data;

          return mutate('SpaceRemovePageFolder', { pageFolderId });
        }

        case SchemaActions.SCHEMA_ADD_ELEMENT: {
          const { data, to, dropPosition, initialItems } = itemParsed.data;

          return mutate('SpaceAddElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems)
          });
        }

        case SchemaActions.SCHEMA_UPDATE_ELEMENT: {
          const { element } = itemParsed.data;

          return mutate('SpaceUpdateElement', { element });
        }

        case SchemaActions.SCHEMA_REMOVE_ELEMENT: {
          const { elementId } = itemParsed.data;

          return mutate('SpaceRemoveElement', { elementId });
        }

        case SchemaActions.SCHEMA_MOVE_ELEMENT: {
          const { elementId, from, to, dropPosition } = itemParsed.data;

          return mutate('SpaceMoveElement', { elementId, from, to, dropPosition });
        }

        case SchemaActions.SCHEMA_CLONE_ELEMENT: {
          const { data, to, dropPosition, initialItems } = itemParsed.data;

          return mutate('SpaceCloneElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems)
          });
        }

        case SchemaActions.SCHEMA_UPDATE_SETTINGS: {
          const { value, path } = itemParsed.data;

          return mutate('SpaceUpdateSettings', { value, path });
        }

        case SchemaActions.SCHEMA_UPDATE: {
          const { schema, queryFailed } = itemParsed.data;
          if (queryFailed) {
            return null;
          }

          return mutate('SpaceUpdateSchema', { schema });
        }

        // case SchemaActions[itemParsed.type]: {
        //   const { schema } = itemParsed.data;

        //   return mutate('SpaceUpdateSchema', { schema });
        // }

        // Style

        case StyleActions.STYLE_ADD_SELECTOR: {
          const { displayMode, selector, path, value } = itemParsed.data;

          return mutate('StyleAddSelector', { displayMode, selector, path, style: value });
        }

        case StyleActions.STYLE_UPDATE_SELECTOR: {
          const { displayMode, selector, path, value } = itemParsed.data;

          return mutate('StyleUpdateSelector', { displayMode, selector, path, style: value });
        }

        case StyleActions.STYLE_REMOVE_SELECTOR: {
          const { selector } = itemParsed.data;

          return mutate('StyleRemoveSelector', { selector: atob(selector) });
        }

        case StyleActions.STYLE_UPDATE: {
          const { style, queryFailed } = itemParsed.data;
          if (queryFailed) {
            return null;
          }

          return mutate('StyleUpdate', { style });
        }

        // case StyleActions[itemParsed.type]: {
        //   const { style } = itemParsed.data;

        //   return mutate('StyleUpdate', { style });
        // }

        // Schema + Style

        case SchemaActions.SCHEMA_ADD_TEMPLATE: {
          const { data, dropPosition, initialItems, to, templatePlatform } = itemParsed.data;

          return mutate('SpaceAddTemplate', {
            element: data,
            styles: templatePlatform,
            to,
            dropPosition,
            initialItems: Object.values(initialItems)
          });
        }

        // segments

        case SegmentsActions.SEGMENTS_REMOVE: {
          const { segmentId } = itemParsed.data;

          return mutate('SegmentRemove', { id: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_ELEMENT: {
          const { data, to, dropPosition, initialItems, segmentId } = itemParsed.data;

          return mutate('SegmentAddElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_UPDATE_ELEMENT: {
          const { element, segmentId } = itemParsed.data;

          return mutate('SegmentUpdateElement', { element, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_REMOVE_ELEMENT: {
          const { elementId, segmentId } = itemParsed.data;

          return mutate('SegmentRemoveElement', { elementId, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_MOVE_ELEMENT: {
          const { elementId, from, to, dropPosition, segmentId } = itemParsed.data;

          return mutate('SegmentMoveElement', { elementId, from, to, dropPosition, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_SELECTOR_ADD: {
          const { displayMode, selector, path, value, segmentId } = itemParsed.data;

          return mutate('SegmentStyleAddSelector', {
            displayMode,
            selector,
            path,
            style: value,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_SELECTOR_UPDATE: {
          const { displayMode, selector, path, value, segmentId } = itemParsed.data;

          return mutate('SegmentStyleUpdateSelector', {
            displayMode,
            selector,
            path,
            style: value,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_SELECTOR_REMOVE: {
          const { selector, segmentId } = itemParsed.data;

          return mutate('SegmentStyleRemoveSelector', { selector: atob(selector), contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
          const { data, dropPosition, initialItems, to, templatePlatform, segmentId } = itemParsed.data;

          return mutate('SegmentAddTemplate', {
            element: data,
            styles: templatePlatform,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_CLONE_ELEMENT: {
          const { data, to, dropPosition, initialItems, segmentId } = itemParsed.data;

          return mutate('SegmentCloneElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_UPDATE: {
          const { segment, queryFailed } = itemParsed.data;
          if (queryFailed) {
            return null;
          }

          return mutate('SegmentUpdate', { id: segment.id, segment });
        }

        // case SegmentsActions[itemParsed.type]: {
        //   const { segmentId } = itemParsed.data;
        //   const { state } = item;

        //   return mutate('SegmentUpdate', { id: segmentId, segment: state[segmentId] });
        // }

        default:
          return null;
      }
    },
    [parseItem, mutate]
  );

  const revertItem = useCallback(async item => {
    const {
      action: { type },
      // state,
      prevState,
      dispatch
    } = item;
    switch (type) {
      case SchemaActions[type]: {
        return dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: prevState, queryFailed: true });
      }

      case StyleActions[type]: {
        return dispatch({ type: StyleActions.STYLE_UPDATE, style: prevState, queryFailed: true });
      }

      case SegmentsActions[type]: {
        return dispatch({ type: SegmentsActions.SEGMENTS_UPDATE, segments: prevState, queryFailed: true });
      }

      default:
        return null;
    }
  }, []);

  const processQueue = useCallback(async () => {
    const { queueNormal } = queues;
    if (queueNormal.length === 0) {
      return;
    }

    setProcessing(true);
    do {
      const item = queueNormal.shift();
      if (item) {
        let result = await processItem(item);
        if (result instanceof Error) {
          for (let currentRetries = 0; currentRetries < maxRetries; currentRetries++) {
            if (result instanceof Error) {
              await delayFunction(retryTimeout);
              result = await processItem(item);
            } else {
              break;
            }
          }

          if (result instanceof Error) {
            // if query fails, we have to revert the change in the builder
            await revertItem(item);
          }
        }
      }
    } while (queueNormal.length > 0);

    setProcessing(false);
  }, [queues, processItem, revertItem, setProcessing, maxRetries, retryTimeout]);

  const queueHandler = useMemo(
    () => ({
      queueNormal: debounce(processQueue, delay),
      queueUrgent: debounce(processQueue, 0)
    }),
    [processQueue, delay]
  );

  const enqueue = useCallback(
    (items = [], priority = 'normal') => {
      if (priority === 'normal') {
        if (Array.isArray(items)) {
          queues.queueNormal.push(...items);
        } else {
          queues.queueNormal.push(items);
        }

        queueHandler.queueNormal();
      }

      if (priority === 'urgent') {
        if (Array.isArray(items)) {
          queues.queueUrgent.push(...items);
        } else {
          queues.queueUrgent.push(items);
        }

        queueHandler.queueUrgent();
      }
    },
    [queues, queueHandler]
  );

  const count = useCallback(
    (priority = 'all') => {
      const { queueNormal, queueUrgent } = queues;

      if (priority === 'normal') {
        return queueNormal.length;
      }

      if (priority === 'urgent') {
        return queueUrgent.length;
      }

      return queueNormal.length + queueUrgent.length;
    },
    [queues]
  );

  const handleBeforeUnload = useCallback(
    e => {
      if (queues.queueNormal.length > 0) {
        e.preventDefault();
        e.returnValue = 'Some changes still being saved.';

        return e;
      }

      return undefined;
    },
    [queues]
  );

  const getIsProcessing = useCallback(() => processingRef.current, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  const queueManagerMemo = useMemo(() => ({ count, enqueue, getIsProcessing }), [count, enqueue, getIsProcessing]);

  return { queueManager: queueManagerMemo, processing };
};

export default useQueueManager;
