import { get, debounce } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';

import { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';
import { delay as delayFunction } from '@plitzi/sdk-shared/helpers/utils';
import { StyleActions } from '@plitzi/sdk-style/StyleReducer';
import { SegmentsActions } from '@pmodules/Segments/SegmentsReducer';

import type { QueueItem, QueuePriority } from '../QueueContext';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  Element,
  Schema,
  SchemaVariable,
  Segment,
  Style
} from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';

export type UseQueueManagerProps = {
  delay?: number;
  mutate: NetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>['mutate'];
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

  const processItem = useCallback(
    async (
      item:
        | QueueItem<Schema, SchemaReducerActions>
        | QueueItem<Style, StyleReducerActions>
        | QueueItem<Record<string, Segment>, SegmentsReducerActions>
    ) => {
      switch (item.action.type) {
        // Schema

        case SchemaActions.SCHEMA_ADD_PAGE: {
          return null; // managed in the provider due that we need the ID from the server
        }

        case SchemaActions.SCHEMA_HOME_PAGE: {
          const { pageId } = item.action;
          const {
            prevState: { flat }
          } = item as { prevState: Schema };
          const page = flat[pageId];
          if (!(page as Element | undefined)) {
            return null;
          }

          const defaultPage = get(page, 'attributes.default', false) as boolean;
          if (defaultPage) {
            return null;
          }

          return mutate('SpaceHomePage', { pageId });
        }

        case SchemaActions.SCHEMA_UPDATE_PAGE: {
          const { page } = item.action;

          return mutate('SpaceUpdatePage', { page });
        }

        case SchemaActions.SCHEMA_REMOVE_PAGE: {
          const { pageId } = item.action;

          return mutate('SpaceRemovePage', { pageId });
        }

        case SchemaActions.SCHEMA_ADD_PAGE_FOLDER: {
          return null; // managed in the provider due that we need the ID from the server
        }

        case SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER: {
          const { pageFolder } = item.action;

          return mutate('SpaceUpdatePageFolder', { pageFolder });
        }

        case SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER: {
          const { pageFolderId } = item.action;

          return mutate('SpaceRemovePageFolder', { pageFolderId });
        }

        case SchemaActions.SCHEMA_ADD_VARIABLE: {
          const { variable } = item.action;

          return mutate('SpaceAddVariable', variable);
        }

        case SchemaActions.SCHEMA_UPDATE_VARIABLE: {
          const { variable } = item.action;

          return mutate('SpaceUpdateVariable', { variable });
        }

        case SchemaActions.SCHEMA_REMOVE_VARIABLE: {
          const { name } = item.action;

          return mutate('SpaceRemoveVariable', { name });
        }

        case SchemaActions.SCHEMA_ADD_ELEMENT: {
          const { data, to, dropPosition, initialItems, variables } = item.action;

          return mutate('SpaceAddElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            variables
          });
        }

        case SchemaActions.SCHEMA_UPDATE_ELEMENT: {
          const { element } = item.action;

          return mutate('SpaceUpdateElement', { element });
        }

        case SchemaActions.SCHEMA_REMOVE_ELEMENT: {
          const { elementId } = item.action;

          return mutate('SpaceRemoveElement', { elementId });
        }

        case SchemaActions.SCHEMA_MOVE_ELEMENT: {
          const { elementId, from, to, dropPosition } = item.action;

          return mutate('SpaceMoveElement', { elementId, from, to, dropPosition });
        }

        case SchemaActions.SCHEMA_CLONE_ELEMENT: {
          const { data, to, dropPosition, initialItems } = item.action;

          return mutate('SpaceCloneElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems)
          });
        }

        case SchemaActions.SCHEMA_UPDATE_SETTINGS: {
          const { value, path } = item.action;

          return mutate('SpaceUpdateSettings', { value, path });
        }

        case SchemaActions.SCHEMA_UPDATE: {
          const { schema, queryFailed } = item.action as typeof item.action & { queryFailed?: boolean };
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
          const { displayMode, selector, selectorType, path, value, params } = item.action;

          return mutate('StyleAddSelector', {
            displayMode,
            selector,
            type: selectorType,
            path,
            style: value,
            params
          });
        }

        case StyleActions.STYLE_UPDATE_SELECTOR: {
          const { displayMode, selector, path, value, params } = item.action;

          return mutate('StyleUpdateSelector', {
            displayMode,
            selector,
            path,
            style: value,
            params
          });
        }

        case StyleActions.STYLE_REMOVE_SELECTOR: {
          const { displayMode, selector } = item.action;

          return mutate('StyleRemoveSelector', { displayMode, selector });
        }

        case StyleActions.STYLE_ADD_SELECTOR_VARIABLE: {
          const { displayMode, selector, category, name, value } = item.action;

          return mutate('StyleAddSelectorVariable', { displayMode, selector, category, name, value });
        }

        case StyleActions.STYLE_UPDATE_SELECTOR_VARIABLE: {
          const { displayMode, selector, category, name, value } = item.action;

          return mutate('StyleUpdateSelectorVariable', { displayMode, selector, category, name, value });
        }

        case StyleActions.STYLE_REMOVE_SELECTOR_VARIABLE: {
          const { displayMode, selector, category, name } = item.action;

          return mutate('StyleRemoveSelectorVariable', { displayMode, selector, category, name });
        }

        case StyleActions.STYLE_ADD_VARIABLE: {
          const { category, name, value } = item.action;

          return mutate('StyleAddVariable', { category, name, value });
        }

        case StyleActions.STYLE_UPDATE_VARIABLE: {
          const { category, name, value } = item.action;

          return mutate('StyleUpdateVariable', { category, name, value });
        }

        case StyleActions.STYLE_REMOVE_VARIABLE: {
          const { category, name } = item.action;

          return mutate('StyleRemoveVariable', { category, name });
        }

        case StyleActions.STYLE_UPDATE: {
          const { style, queryFailed } = item.action as typeof item.action & { queryFailed?: boolean };
          if (queryFailed) {
            return null;
          }

          return mutate('StyleUpdate', { style });
        }

        case StyleActions.STYLE_UPDATE_SETTINGS: {
          const { path, value } = item.action;

          return mutate('StyleUpdateSettings', { path, value });
        }

        // case StyleActions[itemParsed.type]: {
        //   const { style } = itemParsed.data;

        //   return mutate('StyleUpdate', { style });
        // }

        // Schema + Style

        case SchemaActions.SCHEMA_ADD_TEMPLATE: {
          const { data, dropPosition, initialItems, to, variables, style } = item.action;

          return mutate('SpaceAddTemplate', {
            element: data,
            style,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            variables
          });
        }

        // segments

        case SegmentsActions.SEGMENTS_REMOVE: {
          const { segmentId } = item.action;

          return mutate('SegmentRemove', { id: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_ELEMENT: {
          const { data, to, dropPosition, initialItems, variables, segmentId } = item.action as typeof item.action & {
            variables: SchemaVariable[];
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
          const { element, segmentId } = item.action;

          return mutate('SegmentUpdateElement', { element, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_REMOVE_ELEMENT: {
          const { elementId, segmentId } = item.action;

          return mutate('SegmentRemoveElement', { elementId, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_MOVE_ELEMENT: {
          const { elementId, from, to, dropPosition, segmentId } = item.action;

          return mutate('SegmentMoveElement', { elementId, from, to, dropPosition, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_SPACE_ADD_VARIABLE: {
          const { segmentId, variable } = item.action;

          return mutate('SegmentSpaceAddVariable', { contextId: segmentId, variable });
        }

        case SegmentsActions.SEGMENTS_SPACE_UPDATE_VARIABLE: {
          const { segmentId, variable } = item.action;

          return mutate('SegmentSpaceUpdateVariable', { contextId: segmentId, variable });
        }

        case SegmentsActions.SEGMENTS_SPACE_REMOVE_VARIABLE: {
          const { segmentId, name } = item.action;

          return mutate('SegmentSpaceRemoveVariable', { contextId: segmentId, name });
        }

        case SegmentsActions.SEGMENTS_STYLE_ADD_SELECTOR: {
          const { displayMode, selector, selectorType, path, value, params, segmentId } = item.action;

          return mutate('SegmentStyleAddSelector', {
            displayMode,
            selector,
            type: selectorType,
            path,
            style: value,
            params,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR: {
          const { displayMode, selector, path, value, params, segmentId } = item.action;

          return mutate('SegmentStyleUpdateSelector', {
            displayMode,
            selector,
            path,
            style: value,
            params,
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTOR: {
          const { selector, segmentId } = item.action;

          return mutate('SegmentStyleRemoveSelector', { selector, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_STYLE_ADD_SELECTOR_VARIABLE: {
          const { segmentId, displayMode, selector, category, name, value } = item.action;

          return mutate('SegmentStyleAddSelectorVariable', {
            contextId: segmentId,
            displayMode,
            selector,
            category,
            name,
            value
          });
        }

        case SegmentsActions.SEGMENTS_STYLE_UPDATE_SELECTOR_VARIABLE: {
          const { segmentId, displayMode, selector, category, name, value } = item.action;

          return mutate('SegmentStyleUpdateSelectorVariable', {
            contextId: segmentId,
            displayMode,
            selector,
            category,
            name,
            value
          });
        }

        case SegmentsActions.SEGMENTS_STYLE_REMOVE_SELECTOR_VARIABLE: {
          const { segmentId, displayMode, selector, category, name } = item.action;

          return mutate('SegmentStyleRemoveSelectorVariable', {
            contextId: segmentId,
            displayMode,
            selector,
            category,
            name
          });
        }

        case SegmentsActions.SEGMENTS_STYLE_ADD_VARIABLE: {
          const { category, name, value, segmentId } = item.action;

          return mutate('SegmentStyleAddVariable', { category, name, value, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_STYLE_UPDATE_VARIABLE: {
          const { category, name, value, segmentId } = item.action;

          return mutate('SegmentStyleUpdateVariable', { category, name, value, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_STYLE_REMOVE_VARIABLE: {
          const { category, name, segmentId } = item.action;

          return mutate('SegmentStyleRemoveVariable', { category, name, contextId: segmentId });
        }

        case SegmentsActions.SEGMENTS_ADD_TEMPLATE: {
          const { data, dropPosition, initialItems, to, templatePlatform, variables, segmentId } = item.action;

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
          const { data, to, dropPosition, initialItems, segmentId } = item.action;

          return mutate('SegmentCloneElement', {
            element: data,
            to,
            dropPosition,
            initialItems: Object.values(initialItems),
            contextId: segmentId
          });
        }

        case SegmentsActions.SEGMENTS_UPDATE: {
          const { segment, queryFailed } = item.action as typeof item.action & { queryFailed?: boolean };
          if (queryFailed || !segment || !segment.id) {
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
    [mutate]
  );

  const revertItem = useCallback(
    (
      item:
        | QueueItem<Schema, SchemaReducerActions>
        | QueueItem<Style, StyleReducerActions>
        | QueueItem<Record<string, Segment>, SegmentsReducerActions>
    ) => {
      switch (item.action.type) {
        case SchemaActions[item.action.type as keyof typeof SchemaActions]: {
          item = item as QueueItem<Schema, SchemaReducerActions>;
          item.dispatch({
            type: SchemaActions.SCHEMA_UPDATE,
            schema: item.prevState,
            queryFailed: true
          } as SchemaReducerActions);

          return;
        }

        case StyleActions[item.action.type as keyof typeof StyleActions]: {
          item = item as QueueItem<Style, StyleReducerActions>;
          item.dispatch({
            type: StyleActions.STYLE_UPDATE,
            style: item.prevState,
            queryFailed: true
          } as StyleReducerActions);

          return;
        }

        case SegmentsActions[item.action.type as keyof typeof SegmentsActions]: {
          item = item as QueueItem<Record<string, Segment>, SegmentsReducerActions>;
          const segmentId = (item.prevState as unknown as SegmentsReducerActions).segmentId;
          item.dispatch({
            type: SegmentsActions.SEGMENTS_UPDATE,
            segment: item.prevState[segmentId],
            segmentId,
            queryFailed: true
          } as SegmentsReducerActions);

          return;
        }

        default:
          return;
      }
    },
    []
  );

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
