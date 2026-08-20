/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, pick } from '@plitzi/plitzi-ui/helpers';
import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { useMemo, useCallback, use, useEffect } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import SchemaReducer, { SchemaActions } from '@plitzi/sdk-schema/SchemaReducer';
import { isUserEdit } from '@plitzi/sdk-shared/helpers';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';
import { useBuilderStoreGetter, useBuilderStoreSync } from '@plitzi/sdk-shared/store';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type {
  BuilderMutationsMap,
  BuilderNetworkContextValue,
  BuilderQueriesMap,
  SpaceEventMap,
  DropPosition,
  Element,
  PageFolder,
  Schema,
  SchemaRaw,
  SchemaVariable,
  Style
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SchemaContextProviderProps = {
  children?: ReactNode;
  schema?: Schema;
  includeSubscriptions?: boolean;
};

const SchemaContextProvider = ({
  children,
  schema: schemaProp,
  includeSubscriptions = true
}: SchemaContextProviderProps) => {
  const internalData = use(NetworkInternalContext);
  const { eventBridge } = use(EventBridgeContext);
  const schemaPropMemo = useMemo<Schema>(
    () => ({ ...EMPTY_SCHEMA.schema, ...(schemaProp ? schemaProp : internalData.schema) }),
    [schemaProp, internalData.schema]
  );
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  // The history middleware is deliberately unfiltered: it has to SEE another session's edit to know its snapshots
  // are stale (it drops them). The queue must not, or it would send the server back the change it just received.
  const [schema, dispatchSchema] = useReducerWithMiddleware(SchemaReducer, schemaPropMemo, [
    { middleware: undoableMiddleware as ReducerMiddlewareCallback<Schema, [action: SchemaReducerActions]> },
    {
      middleware: enqueueMiddleware as ReducerMiddlewareCallback<Schema, [action: SchemaReducerActions]>,
      filterCallback: isUserEdit
    }
  ]);
  const { mutate, subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap,
    SpaceEventMap
  >;
  useBuilderStoreSync('schema', schema);
  const getSchemaFlat = useBuilderStoreGetter('schema.flat');

  const pageDefinitions = useValueMemo(
    pick(get(schema, 'flat', {} as Record<string, Element>), get(schema, 'pages', [])),
    'soft'
  );
  useBuilderStoreSync('pageDefinitions', pageDefinitions);

  const schemaUpdate = useCallback(
    (newSchema: SchemaRaw, fromSubscriptions = false) =>
      dispatchSchema({
        type: SchemaActions.SCHEMA_UPDATE,
        schema: { ...newSchema, flat: newSchema.flat.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}) },
        fromSubscriptions
      }),
    [dispatchSchema]
  );

  // Elements

  const schemaAddElement = useCallback(
    (
      to: string,
      data: Element,
      dropPosition: DropPosition = 'inside',
      initialItems: Record<string, Element> = {},
      variables: SchemaVariable[] = [],
      fromSubscriptions = false
    ) => {
      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_ELEMENT,
        to,
        data,
        dropPosition,
        initialItems,
        variables,
        fromSubscriptions
      });
    },
    [dispatchSchema]
  );

  const schemaUpdateElement = useCallback(
    (element: Element, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_ELEMENT, element, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaUpdateElements = useCallback(
    (elements: Element[], fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_ELEMENTS, elements, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaMoveElement = useCallback(
    (from: string, to: string, elementId: string, dropPosition: DropPosition = 'inside', fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_MOVE_ELEMENT, from, to, elementId, dropPosition, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaCloneElement = useCallback(
    (elementId: string, targetId?: string, fromSubscriptions = false) => {
      const elements = FlatMap.cloneElements(getSchemaFlat(), elementId, targetId);
      if (!elements.item) {
        return;
      }

      if (elements.acum[elements.item.id] as Element | undefined) {
        delete elements.acum[elements.item.id];
      }

      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_ELEMENT,
        to: targetId ?? get(elements, 'item.definition.parentId', ''),
        data: elements.item,
        dropPosition: 'inside',
        initialItems: elements.acum,
        fromSubscriptions
      });
    },
    [dispatchSchema, getSchemaFlat]
  );

  const schemaRemoveElement = useCallback(
    (elementId: string, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_ELEMENT, elementId, fromSubscriptions }),
    [dispatchSchema]
  );

  // Pages

  const schemaAddPage = useCallback(
    async (page: Element, fromSubscriptions = false) => {
      const response = await mutate('SpaceAddPage', page);
      if (response.result) {
        dispatchSchema({ type: SchemaActions.SCHEMA_ADD_PAGE, page: response.result, fromSubscriptions });
      }
    },
    [dispatchSchema, mutate]
  );

  const schemaHomePage = useCallback(
    (pageId: string, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_HOME_PAGE, pageId, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaUpdatePage = useCallback(
    (page: Element, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_PAGE, page, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaRemovePage = useCallback(
    (pageId: string, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_PAGE, pageId, fromSubscriptions }),
    [dispatchSchema]
  );

  // Page Folders

  const schemaAddPageFolder = useCallback(
    async (pageFolder: PageFolder, fromSubscriptions = false) => {
      const response = await mutate('SpaceAddPageFolder', pageFolder);
      if (response.result) {
        dispatchSchema({ type: SchemaActions.SCHEMA_ADD_PAGE_FOLDER, pageFolder: response.result, fromSubscriptions });
      }
    },
    [dispatchSchema, mutate]
  );

  const schemaUpdatePageFolder = useCallback(
    (pageFolder: PageFolder, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER, pageFolder, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaRemovePageFolder = useCallback(
    (pageFolderId: string, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER, pageFolderId, fromSubscriptions }),
    [dispatchSchema]
  );

  // Variables

  const schemaAddVariable = useCallback(
    (variable: SchemaVariable, fromSubscriptions = false) => {
      dispatchSchema({ type: SchemaActions.SCHEMA_ADD_VARIABLE, variable, fromSubscriptions });
    },
    [dispatchSchema]
  );

  const schemaUpdateVariable = useCallback(
    (variable: SchemaVariable, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_VARIABLE, variable, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaRemoveVariable = useCallback(
    (name: string, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_VARIABLE, name, fromSubscriptions }),
    [dispatchSchema]
  );

  // Others

  const schemaAddTemplate = useCallback(
    (
      to: string,
      data: Element,
      dropPosition: DropPosition = 'inside',
      initialItems: Record<string, Element> = {},
      style?: Style,
      variables: SchemaVariable[] = [],
      fromSubscriptions = false
    ) => {
      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_TEMPLATE,
        to,
        data,
        dropPosition,
        initialItems,
        variables,
        style,
        fromSubscriptions
      });

      void eventBridge.emit('main', 'styleAddTemplate', style?.platform, true);
    },
    [dispatchSchema, eventBridge]
  );

  const schemaUpdateSettings = useCallback(
    (value: string | number | boolean, path: string = '', fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_SETTINGS, value, path, fromSubscriptions }),
    [dispatchSchema]
  );

  useEffect(() => {
    if (!includeSubscriptions) {
      return undefined;
    }

    // Pages
    subscriptionManager.subscribe('SPACE_ADD_PAGE', ({ page }) => void schemaAddPage(page, true));
    subscriptionManager.subscribe('SPACE_SET_HOME_PAGE', ({ page }) => schemaHomePage(page.id, true));
    subscriptionManager.subscribe('SPACE_UPDATE_PAGE', ({ page }) => schemaUpdatePage(page, true));
    subscriptionManager.subscribe('SPACE_REMOVE_PAGE', ({ pageId }) => schemaRemovePage(pageId, true));

    // Page Folders
    subscriptionManager.subscribe('SPACE_ADD_PAGE_FOLDER', ({ pageFolder }) => {
      void schemaAddPageFolder(pageFolder, true);
    });
    subscriptionManager.subscribe('SPACE_UPDATE_PAGE_FOLDER', ({ pageFolder }) =>
      schemaUpdatePageFolder(pageFolder, true)
    );
    subscriptionManager.subscribe('SPACE_REMOVE_PAGE_FOLDER', ({ pageFolderId }) =>
      schemaRemovePageFolder(pageFolderId, true)
    );

    // Variables
    subscriptionManager.subscribe('SPACE_ADD_VARIABLE', ({ variable }) => schemaAddVariable(variable, true));
    subscriptionManager.subscribe('SPACE_UPDATE_VARIABLE', ({ variable }) => schemaUpdateVariable(variable, true));
    subscriptionManager.subscribe('SPACE_REMOVE_VARIABLE', ({ name }) => schemaRemoveVariable(name, true));

    // Elements
    subscriptionManager.subscribe(
      'SPACE_ADD_ELEMENT',
      ({ element, to, dropPosition, initialItems = [], variables = [] }) =>
        schemaAddElement(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          variables,
          true
        )
    );
    subscriptionManager.subscribe('SPACE_UPDATE_ELEMENT', ({ element }) => schemaUpdateElement(element, true));
    subscriptionManager.subscribe('SPACE_UPDATE_ELEMENTS', ({ elements }) => schemaUpdateElements(elements, true));
    subscriptionManager.subscribe('SPACE_REMOVE_ELEMENT', ({ elementId }) => schemaRemoveElement(elementId, true));
    subscriptionManager.subscribe('SPACE_MOVE_ELEMENT', ({ from, to, elementId, dropPosition }) =>
      schemaMoveElement(from, to, elementId, dropPosition, true)
    );
    subscriptionManager.subscribe('SPACE_CLONE_ELEMENT', ({ element, to, dropPosition, initialItems = [] }) =>
      // @todo: the server does not send the clone's variables yet
      schemaAddElement(
        to,
        element,
        dropPosition,
        initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
        [],
        true
      )
    );

    // Others
    subscriptionManager.subscribe('SPACE_UPDATED', ({ schema }) => schemaUpdate(schema, true));
    subscriptionManager.subscribe('SPACE_UPDATE_SETTINGS', ({ value, path }) =>
      schemaUpdateSettings(value, path, true)
    );
    subscriptionManager.subscribe(
      'SPACE_ADD_TEMPLATE',
      ({ element, style, to, dropPosition, initialItems = [], variables = [] }) =>
        schemaAddTemplate(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          style,
          variables,
          true
        )
    );

    // The cleanup names the events and clears every listener on them: this effect owns them all, and the
    // flag says so out loud rather than leaving it to whichever handler happened to register last.
    return () =>
      subscriptionManager.unsubscribe(
        [
          'SPACE_ADD_PAGE',
          'SPACE_SET_HOME_PAGE',
          'SPACE_UPDATE_PAGE',
          'SPACE_REMOVE_PAGE',
          'SPACE_ADD_PAGE_FOLDER',
          'SPACE_UPDATE_PAGE_FOLDER',
          'SPACE_REMOVE_PAGE_FOLDER',
          'SPACE_ADD_VARIABLE',
          'SPACE_UPDATE_VARIABLE',
          'SPACE_REMOVE_VARIABLE',
          'SPACE_ADD_ELEMENT',
          'SPACE_UPDATE_ELEMENT',
          'SPACE_UPDATE_ELEMENTS',
          'SPACE_REMOVE_ELEMENT',
          'SPACE_MOVE_ELEMENT',
          'SPACE_CLONE_ELEMENT',
          'SPACE_UPDATED',
          'SPACE_UPDATE_SETTINGS',
          'SPACE_ADD_TEMPLATE'
        ],
        true
      );
  }, [
    subscriptionManager,
    includeSubscriptions,
    schemaAddPage,
    schemaHomePage,
    schemaUpdatePage,
    schemaRemovePage,
    schemaAddPageFolder,
    schemaUpdatePageFolder,
    schemaRemovePageFolder,
    schemaAddVariable,
    schemaUpdateVariable,
    schemaRemoveVariable,
    schemaUpdateSettings,
    schemaAddElement,
    schemaUpdateElement,
    schemaUpdateElements,
    schemaRemoveElement,
    schemaMoveElement,
    schemaUpdate,
    schemaAddTemplate
  ]);

  // When type = 'main'
  const mainEvents = useMemo(
    () => ({
      schemaAddPage,
      schemaHomePage,
      schemaUpdatePage,
      schemaRemovePage,
      schemaAddPageFolder,
      schemaUpdatePageFolder,
      schemaRemovePageFolder,
      schemaAddVariable,
      schemaUpdateVariable,
      schemaRemoveVariable,
      schemaUpdateSettings
    }),
    [
      schemaAddPage,
      schemaHomePage,
      schemaUpdatePage,
      schemaRemovePage,
      schemaAddPageFolder,
      schemaUpdatePageFolder,
      schemaRemovePageFolder,
      schemaAddVariable,
      schemaUpdateVariable,
      schemaRemoveVariable,
      schemaUpdateSettings
    ]
  );

  useEventBridge('main', mainEvents, undefined, undefined);
  // End When type = 'main'

  const events = useMemo(
    () => ({
      schemaUpdate,
      schemaAddElement,
      schemaUpdateElement,
      schemaUpdateElements,
      schemaMoveElement,
      schemaCloneElement,
      schemaRemoveElement,
      schemaAddTemplate
    }),
    [
      schemaUpdate,
      schemaAddElement,
      schemaUpdateElement,
      schemaUpdateElements,
      schemaMoveElement,
      schemaCloneElement,
      schemaRemoveElement,
      schemaAddTemplate
    ]
  );

  useEventBridge('main', events);

  const valueMemo = useMemo(() => {
    return {
      dispatchSchema,
      schemaUpdate,
      schemaAddElement,
      schemaUpdateElement,
      schemaUpdateElements,
      schemaMoveElement,
      schemaCloneElement,
      schemaRemoveElement,
      schemaAddPage,
      schemaHomePage,
      schemaUpdatePage,
      schemaRemovePage,
      schemaAddPageFolder,
      schemaUpdatePageFolder,
      schemaRemovePageFolder,
      schemaAddVariable,
      schemaUpdateVariable,
      schemaRemoveVariable,
      schemaAddTemplate,
      schemaUpdateSettings
    };
  }, [
    dispatchSchema,
    schemaUpdate,
    schemaAddElement,
    schemaUpdateElement,
    schemaUpdateElements,
    schemaMoveElement,
    schemaCloneElement,
    schemaRemoveElement,
    schemaAddTemplate,
    schemaUpdateSettings,
    schemaAddPage,
    schemaHomePage,
    schemaUpdatePage,
    schemaRemovePage,
    schemaAddPageFolder,
    schemaUpdatePageFolder,
    schemaRemovePageFolder,
    schemaAddVariable,
    schemaUpdateVariable,
    schemaRemoveVariable
  ]);

  return <SchemaContext value={valueMemo}>{children}</SchemaContext>;
};

export default SchemaContextProvider;
