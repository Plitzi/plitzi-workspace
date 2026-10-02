import { get, debounce } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useEffect, useState } from 'react';

import { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';
import { delay as delayFunction } from '@plitzi/sdk-shared/helpers/utils';
import { StyleActions } from '@plitzi/sdk-style/StyleReducer';

import { worthRetrying, writeFailed } from '../helpers';

import type { QueueItem } from '../QueueContext';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { BuilderMutationsMap, BuilderQueriesMap, Element, Schema, Style } from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';

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
  const queue = useMemo<QueueItem[]>(() => [], []);
  const [processing, setProcessing] = useState(false);

  const processItem = useCallback(
    async (item: QueueItem<Schema, SchemaReducerActions> | QueueItem<Style, StyleReducerActions>) => {
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

        case SchemaActions.SCHEMA_SET_FLAG: {
          const { name, flag } = item.action;

          return mutate('SpaceSetFlag', { name, flag });
        }

        case SchemaActions.SCHEMA_REMOVE_FLAG: {
          const { name } = item.action;

          return mutate('SpaceRemoveFlag', { name });
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

        case SchemaActions.SCHEMA_RENAME_ELEMENT: {
          const { elementId, id } = item.action;

          return mutate('SpaceRenameElement', { elementId, id });
        }

        case SchemaActions.SCHEMA_UPDATE_ELEMENTS: {
          const { elements } = item.action;

          return mutate('SpaceUpdateElements', { elements });
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

        case SchemaActions.SCHEMA_ADD_COMPONENT: {
          const { component, from } = item.action;

          return mutate('SpaceAddComponent', { component, from });
        }

        case SchemaActions.SCHEMA_UPDATE_COMPONENT: {
          const { componentId, declaration } = item.action;

          return mutate('SpaceUpdateComponent', { componentId, declaration });
        }

        case SchemaActions.SCHEMA_REMOVE_COMPONENT: {
          const { componentId } = item.action;

          return mutate('SpaceRemoveComponent', { componentId });
        }

        case SchemaActions.SCHEMA_DETACH_INSTANCE: {
          const { instanceId } = item.action;

          return mutate('SpaceDetachInstance', { instanceId });
        }

        case SchemaActions.SCHEMA_UPDATE_SETTINGS: {
          const { value, path } = item.action;

          return mutate('SpaceUpdateSettings', { value, path });
        }

        case SchemaActions.SCHEMA_UPDATE: {
          const { schema } = item.action;

          return mutate('SpaceUpdateSchema', { schema });
        }

        case StyleActions.STYLE_ADD_SELECTOR: {
          const { displayMode, selector, selectorType, path, value, params } = item.action;

          return mutate('StyleAddSelector', { displayMode, selector, type: selectorType, path, style: value, params });
        }

        case StyleActions.STYLE_UPDATE_SELECTOR: {
          const { displayMode, selector, path, value, params } = item.action;

          return mutate('StyleUpdateSelector', { displayMode, selector, path, style: value, params });
        }

        case StyleActions.STYLE_REMOVE_SELECTOR: {
          const { displayMode, selector } = item.action;

          return mutate('StyleRemoveSelector', { displayMode, selector });
        }

        case StyleActions.STYLE_REMOVE_SELECTORS: {
          const { displayMode, selectors } = item.action;

          return mutate('StyleRemoveSelectors', { displayMode, selectors });
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

        case StyleActions.STYLE_ADD_FONT: {
          const { font } = item.action;

          return mutate('StyleAddFont', { font });
        }

        case StyleActions.STYLE_UPDATE_FONT: {
          const { family, font } = item.action;

          return mutate('StyleUpdateFont', { family, font });
        }

        case StyleActions.STYLE_REMOVE_FONT: {
          const { family } = item.action;

          return mutate('StyleRemoveFont', { family });
        }

        case StyleActions.STYLE_UPDATE: {
          const { style } = item.action;

          return mutate('StyleUpdate', { style });
        }

        case StyleActions.STYLE_UPDATE_SETTINGS: {
          const { path, value } = item.action;

          return mutate('StyleUpdateSettings', { path, value });
        }

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

        default:
          return null;
      }
    },
    [mutate]
  );

  // Putting back the state a rejected mutation left behind. `queryFailed` is what keeps this dispatch out of both
  // middlewares (`isUserEdit`): the user did not make this change, so it is not undoable, and re-queueing it would
  // send the server the very state it just refused.
  const revertItem = useCallback(
    (item: QueueItem<Schema, SchemaReducerActions> | QueueItem<Style, StyleReducerActions>) => {
      switch (item.action.type) {
        case SchemaActions[item.action.type as keyof typeof SchemaActions]: {
          const schemaItem = item as QueueItem<Schema, SchemaReducerActions>;
          schemaItem.dispatch({ type: SchemaActions.SCHEMA_UPDATE, schema: schemaItem.prevState, queryFailed: true });

          return;
        }

        case StyleActions[item.action.type as keyof typeof StyleActions]: {
          const styleItem = item as QueueItem<Style, StyleReducerActions>;
          styleItem.dispatch({ type: StyleActions.STYLE_UPDATE, style: styleItem.prevState, queryFailed: true });

          return;
        }

        default:
          return;
      }
    },
    []
  );

  const processQueue = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    setProcessing(true);
    do {
      const item = queue.shift();
      if (item) {
        let outcome = await processItem(item);
        for (let attempt = 0; attempt < maxRetries && worthRetrying(outcome); attempt++) {
          await delayFunction(retryTimeout);
          outcome = await processItem(item);
        }

        // The builder already shows the change; the server not storing it means taking it back, or the two drift apart
        // and the next save builds on a state the server never had.
        if (writeFailed(outcome)) {
          revertItem(item);
        }
      }
    } while (queue.length > 0);

    setProcessing(false);
  }, [queue, processItem, revertItem, maxRetries, retryTimeout]);

  const processQueueDebounced = useMemo(() => debounce(processQueue, delay), [processQueue, delay]);

  const enqueue = useCallback(
    (item: QueueItem) => {
      if (disabled) {
        return;
      }

      queue.push(item);
      void processQueueDebounced();
    },
    [queue, processQueueDebounced, disabled]
  );

  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (queue.length > 0) {
        e.preventDefault();
        e.returnValue = 'Some changes still being saved.';

        return e;
      }

      return undefined;
    },
    [queue]
  );

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  return { enqueue, processing };
};

export default useQueueManager;
