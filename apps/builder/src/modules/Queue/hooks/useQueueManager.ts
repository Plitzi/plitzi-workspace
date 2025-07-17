import debounce from 'lodash/debounce';
import get from 'lodash/get';
import omit from 'lodash/omit';
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';

import { delay as delayFunction } from '@plitzi/sdk-shared/helpers/utils';
import { SchemaActions } from '@pmodules/Schema/SchemaReducer';
import { SegmentsActions } from '@pmodules/Segments/SegmentsReducer';
import { StyleActions } from '@pmodules/Style/StyleReducer';

import type { QueueItem, QueuePriority } from '../QueueContext';
import type { DropPosition } from '@plitzi/sdk-schema/helpers/FlatMap';
import type { Element, PageFolder, Schema, SchemaVariable, Segment, Style } from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@pmodules/Network/NetworkContext';

export type UseQueueManagerProps = {
  delay?: number;
  mutate: NetworkContextValue['mutate'];
  maxRetries?: number;
  retryTimeout?: number;
  disabled?: boolean;
};

const useQueueManager = ({
  delay = 1000,
  mutate,
  maxRetries = 2,
  retryTimeout = 2500,
  disabled = false
}: UseQueueManagerProps) => {
  const queues = useMemo<{ queueNormal: QueueItem[]; queueUrgent: QueueItem[] }>(
    () => ({ queueNormal: [], queueUrgent: [] }),
    []
  );
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(processing);
  processingRef.current = processing;

  const parseItem = useCallback((rawItem: QueueItem) => {
    const { action } = rawItem;

    return { type: action.type, data: omit(action, ['type']) };
  }, []);

  const processItem = useCallback(
    async (item: QueueItem) => {
      const itemParsed = parseItem(item);
      switch (itemParsed.type) {
        // Schema

        case SchemaActions.SCHEMA_ADD_PAGE: {
          return null; // managed in the provider due that we need the ID from the server
        }

        case SchemaActions.SCHEMA_HOME_PAGE: {
          const { pageId } = itemParsed.data as { pageId: string };
          const {
            prevState: { flat }
          } = item as { prevState: Schema };
          const page = flat[pageId];
          if (!(page as Element | undefined)) {
            return null;
          }

          const defaultPage = get(page, 'attributes.default', false);
          if (defaultPage) {
            return null;
          }

          return mutate('SpaceHomePage', { pageId });
        }

        case SchemaActions.SCHEMA_UPDATE_PAGE: {
          const { page } = itemParsed.data as { page: Element };

          return mutate('SpaceUpdatePage', { page });
        }

        case SchemaActions.SCHEMA_REMOVE_PAGE: {
          const { pageId } = itemParsed.data as { pageId: string };

          return mutate('SpaceRemovePage', { pageId });
        }

        case SchemaActions.SCHEMA_ADD_PAGE_FOLDER: {
          return null; // managed in the provider due that we need the ID from the server
        }

        case SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER: {
          const { pageFolder } = itemParsed.data as { pageFolder: PageFolder };

          return mutate('SpaceUpdatePageFolder', { pageFolder });
        }

        case SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER: {
          const { pageFolderId } = itemParsed.data as { pageFolderId: string };

          return mutate('SpaceRemovePageFolder', { pageFolderId });
        }

        case SchemaActions.SCHEMA_ADD_VARIABLE: {
          const { variable } = itemParsed.data as { variable: SchemaVariable };

          return mutate('SpaceAddVariable', variable);
        }

        case SchemaActions.SCHEMA_UPDATE_VARIABLE: {
          const { variable } = itemParsed.data;

          return mutate('SpaceUpdateVariable', { variable });
        }

        case SchemaActions.SCHEMA_REMOVE_VARIABLE: {
          const { name } = itemParsed.data;

          return mutate('SpaceRemoveVariable', { name });
        }

        case SchemaActions.SCHEMA_ADD_ELEMENT: {
          const { data, to, dropPosition, initialItems, variables } = itemParsed.data as {
            data: Element;
            to: string;
            dropPosition: DropPosition;
            initialItems: Record<string, Element>;
            variables: SchemaVariable[];
          };

          return mutate('SpaceAddElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            variables
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
          const { data, to, dropPosition, initialItems } = itemParsed.data as {
            data: Element;
            to: string;
            dropPosition: DropPosition;
            initialItems: Record<string, Element>;
          };

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
          const { displayMode, selector, selectorType, path, value } = itemParsed.data;

          return mutate('StyleAddSelector', { displayMode, selector, type: selectorType, path, style: value });
        }

        case StyleActions.STYLE_UPDATE_SELECTOR: {
          const { displayMode, selector, selectorType, path, value } = itemParsed.data;

          return mutate('StyleUpdateSelector', { displayMode, selector, type: selectorType, path, style: value });
        }

        case StyleActions.STYLE_REMOVE_SELECTOR: {
          const { selector } = itemParsed.data;

          return mutate('StyleRemoveSelector', { selector });
        }

        case StyleActions.STYLE_ADD_VARIABLE: {
          const { variable, value } = itemParsed.data;

          return mutate('StyleAddVariable', { variable, value });
        }

        case StyleActions.STYLE_UPDATE_VARIABLE: {
          const { variable, value } = itemParsed.data;

          return mutate('StyleUpdateVariable', { variable, value });
        }

        case StyleActions.STYLE_REMOVE_VARIABLE: {
          const { variable } = itemParsed.data;

          return mutate('StyleRemoveVariable', { variable });
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
          const { data, dropPosition, initialItems, to, templatePlatform, variables } = itemParsed.data as {
            data: Element;
            to: string;
            dropPosition: DropPosition;
            initialItems: Record<string, Element>;
            variables: SchemaVariable[];
            templatePlatform: Style['platform'];
          };

          return mutate('SpaceAddTemplate', {
            element: data,
            styles: templatePlatform,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            variables
          });
        }

        // segments

        case SegmentsActions.SEGMENTS_REMOVE: {
          const { segmentId } = itemParsed.data;

          return mutate('SegmentRemove', { id: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_ELEMENT: {
          const { data, to, dropPosition, initialItems, variables, segmentId } = itemParsed.data as {
            data: Element;
            to: string;
            dropPosition: DropPosition;
            initialItems: Record<string, Element>;
            variables: SchemaVariable[];
            segmentId: string;
          };

          return mutate('SegmentAddElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            variables,
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

        case SegmentsActions.SEGMENTS_ADD_SELECTOR: {
          const { displayMode, selector, selectorType, path, value, segmentId } = itemParsed.data;

          return mutate('SegmentStyleAddSelector', {
            displayMode,
            selector,
            type: selectorType,
            path,
            style: value,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_UPDATE_SELECTOR: {
          const { displayMode, selector, selectorType, path, value, segmentId } = itemParsed.data;

          return mutate('SegmentStyleUpdateSelector', {
            displayMode,
            selector,
            type: selectorType,
            path,
            style: value,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_REMOVE_SELECTOR: {
          const { selector, segmentId } = itemParsed.data;

          return mutate('SegmentStyleRemoveSelector', { selector, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_VARIABLE: {
          const { variable, value, segmentId } = itemParsed.data;

          return mutate('SegmentStyleAddVariable', { variable, value, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_UPDATE_VARIABLE: {
          const { variable, value, segmentId } = itemParsed.data;

          return mutate('SegmentStyleUpdateVariable', { variable, value, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_REMOVE_VARIABLE: {
          const { variable, segmentId } = itemParsed.data;

          return mutate('SegmentStyleRemoveVariable', { variable, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
          const { data, dropPosition, initialItems, to, templatePlatform, variables, segmentId } = itemParsed.data as {
            data: Element;
            to: string;
            dropPosition: DropPosition;
            initialItems: Record<string, Element>;
            variables: SchemaVariable[];
            templatePlatform: Style['platform'];
            segmentId: string;
          };

          return mutate('SegmentAddTemplate', {
            element: data,
            styles: templatePlatform,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            variables,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_CLONE_ELEMENT: {
          const { data, to, dropPosition, initialItems, segmentId } = itemParsed.data as {
            data: Element;
            to: string;
            dropPosition: DropPosition;
            initialItems: Record<string, Element>;
            segmentId: string;
          };

          return mutate('SegmentCloneElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_UPDATE: {
          const { segment, queryFailed } = itemParsed.data as { segment: Segment; queryFailed: unknown };
          if (queryFailed || !segment.id) {
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

  const revertItem = useCallback((item: QueueItem) => {
    const {
      action: { type },
      // state,
      prevState,
      dispatch
    } = item;
    switch (type) {
      case SchemaActions[type]: {
        dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: prevState, queryFailed: true });

        return;
      }

      case StyleActions[type]: {
        dispatch({ type: StyleActions.STYLE_UPDATE, style: prevState, queryFailed: true });

        return;
      }

      case SegmentsActions[type]: {
        dispatch({ type: SegmentsActions.SEGMENTS_UPDATE, segments: prevState, queryFailed: true });

        return;
      }

      default:
        return;
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
            revertItem(item);
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
    (items: QueueItem | QueueItem[] = [], priority: QueuePriority = 'normal') => {
      if (disabled) {
        return;
      }

      if (priority === 'normal') {
        if (Array.isArray(items)) {
          queues.queueNormal.push(...items);
        } else {
          queues.queueNormal.push(items);
        }

        void queueHandler.queueNormal();
      }

      if (priority === 'urgent') {
        if (Array.isArray(items)) {
          queues.queueUrgent.push(...items);
        } else {
          queues.queueUrgent.push(items);
        }

        void queueHandler.queueUrgent();
      }
    },
    [queues, queueHandler, disabled]
  );

  const count = useCallback(
    (priority: QueuePriority = 'all') => {
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
    (e: BeforeUnloadEvent) => {
      if (queues.queueNormal.length > 0) {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
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
