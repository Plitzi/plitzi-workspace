// Packages
import React, { useMemo, useRef, useCallback, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import pick from 'lodash/pick';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import useReducerWithMiddleware from '@plitzi/plitzi-ui-components/hooks/useReducerWithMiddleware';

// Monorepo
import useEventBridge from '@repo/event-bridge/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@repo/event-bridge/EventBridgeHelper';
import EventBridgeContext from '@repo/event-bridge/EventBridgeContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import { SubscriptionEventTypes } from '@pmodules/Network/helpers/EventTypes';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

// Relatives
import FlatMap, { DROP_DIRECTION_INSIDE } from './helpers/FlatMap';
import SchemaContext from './SchemaContext';
import SchemaReducer, { SchemaActions } from './SchemaReducer';
import SchemaMainContext from './SchemaMainContext';

export const SCHEMA_TYPE_MAIN = 'main';
export const SCHEMA_TYPE_PARTIAL = 'partial';
export const SCHEMA_TYPE_TEMPLATE = 'template';
export const SCHEMA_TYPE_SEGMENT = 'segment';

const SchemaContextProvider = props => {
  const { children, type = SCHEMA_TYPE_MAIN, schema: schemaProp, includeSubscriptions = true } = props;
  const { addToast } = useToast();
  const internalData = useContext(NetworkInternalContext);
  const { eventBridge } = useContext(EventBridgeContext);
  const schemaPropMemo = useMemo(() => {
    if (schemaProp) {
      return schemaProp;
    }

    switch (type) {
      case SCHEMA_TYPE_MAIN:
        return internalData.schema;

      case SCHEMA_TYPE_PARTIAL:
      case SCHEMA_TYPE_TEMPLATE:
        return { flat: {} };

      default:
        return { settings: { customCss: '' }, flat: {}, pages: [] };
    }
  }, [schemaProp]);
  const { enqueueMiddleware } = useContext(QueueContext);
  const { undoableMiddleware } = useContext(UndoableContext);
  const middlewareMemo = useMemo(
    () => [
      {
        middleware: undoableMiddleware,
        filterCallback: action => !action.fromSubscriptions && type === SCHEMA_TYPE_MAIN
      },
      {
        middleware: enqueueMiddleware,
        filterCallback: action => !action.fromSubscriptions && type === SCHEMA_TYPE_MAIN
      }
    ],
    [undoableMiddleware]
  );
  const [schema, dispatchSchema] = useReducerWithMiddleware(SchemaReducer, schemaPropMemo, middlewareMemo);
  const schemaRef = useRef(schema);
  const { mutate, subscriptionManager } = useContext(NetworkContext);
  schemaRef.current = schema;

  const schemaUpdate = useCallback(
    (newSchema, fromSubscriptions = false) =>
      dispatchSchema({
        type: SchemaActions.SCHEMA_UPDATE,
        schema: { ...newSchema, flat: newSchema.flat.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}) },
        fromSubscriptions
      }),
    [dispatchSchema]
  );

  // Elements

  const schemaAddElement = useCallback(
    (to, data, dropPosition = DROP_DIRECTION_INSIDE, initialItems = {}, fromSubscriptions = false) =>
      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_ELEMENT,
        to,
        data,
        dropPosition,
        initialItems,
        fromSubscriptions
      }),
    [dispatchSchema]
  );

  const schemaUpdateElement = useCallback(
    (element, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_ELEMENT, element, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaMoveElement = useCallback(
    (from, to, elementId, dropPosition = DROP_DIRECTION_INSIDE, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_MOVE_ELEMENT, from, to, elementId, dropPosition, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaCloneElement = useCallback(
    (elementId, targetId, fromSubscriptions = false) => {
      const flat = get(schemaRef.current, 'flat');
      const elements = FlatMap.clone(flat, elementId, targetId);
      if (!elements || !elements.item) {
        return;
      }

      if (elements.acum[elements.item.id]) {
        delete elements.acum[elements.item.id];
      }

      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_ELEMENT,
        to: targetId ?? get(elements, 'item.definition.parentId'),
        data: elements.item,
        dropPosition: DROP_DIRECTION_INSIDE,
        initialItems: elements.acum,
        fromSubscriptions
      });
    },
    [dispatchSchema]
  );

  const schemaRemoveElement = useCallback(
    (elementId, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_ELEMENT, elementId, fromSubscriptions }),
    [dispatchSchema]
  );

  // Pages

  const schemaAddPage = useCallback(
    async (page, fromSubscriptions = false) => {
      const result = await mutate('SpaceAddPage', page);
      if (result instanceof Error) {
        addToast(result.message, {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      } else if (result) {
        dispatchSchema({ type: SchemaActions.SCHEMA_ADD_PAGE, page: result, fromSubscriptions });
      }
    },
    [dispatchSchema]
  );

  const schemaHomePage = useCallback(
    (pageId, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_HOME_PAGE, pageId, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaUpdatePage = useCallback(
    (page, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_PAGE, page, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaRemovePage = useCallback(
    (pageId, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_PAGE, pageId, fromSubscriptions }),
    [dispatchSchema]
  );

  // Page Folders

  const schemaAddPageFolder = useCallback(
    async (pageFolder, fromSubscriptions = false) => {
      const result = await mutate('SpaceAddPageFolder', pageFolder);
      if (result instanceof Error) {
        addToast(result.message, {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      } else if (result) {
        dispatchSchema({ type: SchemaActions.SCHEMA_ADD_PAGE_FOLDER, pageFolder: result, fromSubscriptions });
      }
    },
    [dispatchSchema]
  );

  const schemaUpdatePageFolder = useCallback(
    (pageFolder, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_PAGE_FOLDER, pageFolder, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaRemovePageFolder = useCallback(
    (pageFolderId, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_PAGE_FOLDER, pageFolderId, fromSubscriptions }),
    [dispatchSchema]
  );

  // Others

  const schemaAddTemplate = useCallback(
    (
      to,
      data,
      dropPosition = DROP_DIRECTION_INSIDE,
      initialItems = {},
      templatePlatform = null,
      fromSubscriptions = false
    ) => {
      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_TEMPLATE,
        to,
        data,
        dropPosition,
        initialItems,
        templatePlatform,
        fromSubscriptions
      });

      eventBridge.emit(EventBridgeModuleTypes.MAIN, 'styleAddTemplate', templatePlatform, true);
    },
    [dispatchSchema, eventBridge]
  );

  const schemaUpdateSettings = useCallback(
    (value, path = '', fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_SETTINGS, value, path, fromSubscriptions }),
    [dispatchSchema]
  );

  useEffect(() => {
    if (subscriptionManager && includeSubscriptions && type === SCHEMA_TYPE_MAIN) {
      if (type === SCHEMA_TYPE_MAIN) {
        // Pages

        subscriptionManager.subscribe('SpaceAddPage', SubscriptionEventTypes.SPACE_ADD_PAGE, {}, data => {
          const { page } = get(data, 'data.SpaceAddPage', {});
          schemaAddPage(page, true);
        });

        subscriptionManager.subscribe('SpaceHomePage', SubscriptionEventTypes.SPACE_SET_HOME_PAGE, {}, data => {
          const {
            page: { id }
          } = get(data, 'data.SpaceHomePage', {});
          schemaHomePage(id, true);
        });

        subscriptionManager.subscribe('SpaceUpdatePage', SubscriptionEventTypes.SPACE_UPDATE_PAGE, {}, data => {
          const { page } = get(data, 'data.SpaceUpdatePage', {});
          schemaUpdatePage(page, true);
        });

        subscriptionManager.subscribe('SpaceRemovePage', SubscriptionEventTypes.SPACE_REMOVE_PAGE, {}, data => {
          const { pageId } = get(data, 'data.SpaceRemovePage', {});
          schemaRemovePage(pageId, true);
        });

        // Page Folders

        subscriptionManager.subscribe('SpaceAddPageFolder', SubscriptionEventTypes.SPACE_ADD_PAGE_FOLDER, {}, data => {
          const { pageFolder } = get(data, 'data.SpaceAddPageFolder', {});
          schemaAddPageFolder(pageFolder, true);
        });

        subscriptionManager.subscribe(
          'SpaceUpdatePageFolder',
          SubscriptionEventTypes.SPACE_UPDATE_PAGE_FOLDER,
          {},
          data => {
            const { pageFolder } = get(data, 'data.SpaceUpdatePageFolder', {});
            schemaUpdatePageFolder(pageFolder, true);
          }
        );

        subscriptionManager.subscribe(
          'SpaceRemovePageFolder',
          SubscriptionEventTypes.SPACE_REMOVE_PAGE_FOLDER,
          {},
          data => {
            const { pageFolderId } = get(data, 'data.SpaceRemovePageFolder', {});
            schemaRemovePageFolder(pageFolderId, true);
          }
        );

        // Others

        subscriptionManager.subscribe('SpaceUpdateSettings', SubscriptionEventTypes.SPACE_UPDATE_SETTINGS, {}, data => {
          const { value, path } = get(data, 'data.SpaceUpdateSettings', {});
          schemaUpdateSettings(value, path, true);
        });
      }

      // Elements

      subscriptionManager.subscribe('SpaceAddElement', SubscriptionEventTypes.SPACE_ADD_ELEMENT, {}, data => {
        const { element, to, dropPosition, initialItems = [] } = get(data, 'data.SpaceAddElement', {});
        schemaAddElement(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          true
        );
      });

      subscriptionManager.subscribe('SpaceUpdateElement', SubscriptionEventTypes.SPACE_UPDATE_ELEMENT, {}, data => {
        const { element } = get(data, 'data.SpaceUpdateElement', {});
        schemaUpdateElement(element, true);
      });

      subscriptionManager.subscribe('SpaceRemoveElement', SubscriptionEventTypes.SPACE_REMOVE_ELEMENT, {}, data => {
        const { elementId } = get(data, 'data.SpaceRemoveElement', {});
        schemaRemoveElement(elementId, true);
      });

      subscriptionManager.subscribe('SpaceMoveElement', SubscriptionEventTypes.SPACE_MOVE_ELEMENT, {}, data => {
        const { from, to, elementId, dropPosition } = get(data, 'data.SpaceMoveElement', {});
        schemaMoveElement(from, to, elementId, dropPosition, true);
      });

      subscriptionManager.subscribe('SpaceCloneElement', SubscriptionEventTypes.SPACE_CLONE_ELEMENT, {}, data => {
        const { element, to, dropPosition, initialItems = [] } = get(data, 'data.SpaceCloneElement', {});
        schemaAddElement(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          true
        );
      });

      // Others

      subscriptionManager.subscribe('SpaceUpdated', SubscriptionEventTypes.SPACE_UPDATED, {}, data => {
        const { schema } = get(data, 'data.SpaceUpdated', {});
        schemaUpdate(schema, true);
      });

      subscriptionManager.subscribe('SpaceAddTemplate', SubscriptionEventTypes.SPACE_ADD_TEMPLATE, {}, data => {
        const { element, styles, to, dropPosition, initialItems = [] } = get(data, 'data.SpaceAddTemplate', {});
        schemaAddTemplate(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          styles,
          true
        );
      });
    }
  }, [subscriptionManager, includeSubscriptions, type]);

  if (type === SCHEMA_TYPE_MAIN) {
    const mainEvents = useMemo(
      () => ({
        schemaAddPage,
        schemaHomePage,
        schemaUpdatePage,
        schemaRemovePage,
        schemaAddPageFolder,
        schemaUpdatePageFolder,
        schemaRemovePageFolder,
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
        schemaUpdateSettings
      ]
    );

    useEventBridge(EventBridgeModuleTypes.MAIN, mainEvents);
  }

  const events = useMemo(
    () => ({
      schemaUpdate,
      schemaAddElement,
      schemaUpdateElement,
      schemaMoveElement,
      schemaCloneElement,
      schemaRemoveElement,
      schemaAddTemplate
    }),
    [
      schemaUpdate,
      schemaAddElement,
      schemaUpdateElement,
      schemaMoveElement,
      schemaCloneElement,
      schemaRemoveElement,
      schemaAddTemplate
    ]
  );

  useEventBridge(EventBridgeModuleTypes.MAIN, events);

  const valueMemo = useMemo(() => {
    if (type === SCHEMA_TYPE_MAIN) {
      return {
        dispatchSchema,
        schema,
        schemaUpdate,
        schemaAddElement,
        schemaUpdateElement,
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
        schemaAddTemplate,
        schemaUpdateSettings
      };
    }

    return {
      dispatchSchema,
      schema,
      schemaUpdate,
      schemaAddElement,
      schemaUpdateElement,
      schemaMoveElement,
      schemaCloneElement,
      schemaRemoveElement,
      schemaAddTemplate,
      schemaUpdateSettings
    };
  }, [
    dispatchSchema,
    schema,
    schemaUpdate,
    schemaAddElement,
    schemaUpdateElement,
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
    schemaAddTemplate,
    schemaUpdateSettings
  ]);

  const mainSchemaValueMemo = useMemo(
    () => ({
      pages: get(schema, 'pages', []),
      pageDefinitions: pick(get(schema, 'flat', {}), get(schema, 'pages', [])),
      pageFolders: get(schema, 'pageFolders', []),
      settings: get(schema, 'settings', {})
    }),
    [schema.pages, schema.settings, schema.pageFolders, schema.flat]
  );

  if (type === SCHEMA_TYPE_MAIN) {
    return (
      <SchemaMainContext.Provider value={mainSchemaValueMemo}>
        <SchemaContext.Provider value={valueMemo}>{children}</SchemaContext.Provider>
      </SchemaMainContext.Provider>
    );
  }

  return <SchemaContext.Provider value={valueMemo}>{children}</SchemaContext.Provider>;
};

SchemaContextProvider.propTypes = {
  children: PropTypes.node,
  schema: PropTypes.object,
  includeSubscriptions: PropTypes.bool,
  type: PropTypes.oneOf([SCHEMA_TYPE_MAIN, SCHEMA_TYPE_PARTIAL, SCHEMA_TYPE_TEMPLATE, SCHEMA_TYPE_SEGMENT])
};

export default SchemaContextProvider;
