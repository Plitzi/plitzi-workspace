// Packages
import React, { useMemo, useRef, useCallback, use, useEffect } from 'react';
import get from 'lodash/get';
import pick from 'lodash/pick';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import useReducerWithMiddleware from '@plitzi/plitzi-ui-components/hooks/useReducerWithMiddleware';

// Monorepo
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import FlatMap, { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

// Relatives
import SchemaReducer, { SchemaActions } from './SchemaReducer';

export const SCHEMA_TYPE_MAIN = 'main';
export const SCHEMA_TYPE_PARTIAL = 'partial';
export const SCHEMA_TYPE_TEMPLATE = 'template';
export const SCHEMA_TYPE_SEGMENT = 'segment';

/**
 * @param {{
 *   children: React.ReactNode;
 *   type?: 'main' | 'partial' | 'template' | 'segment';
 *   schema?: object;
 *   includeSubscriptions?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const SchemaContextProvider = props => {
  const { children, type = SCHEMA_TYPE_MAIN, schema: schemaProp, includeSubscriptions = true } = props;
  const { addToast } = useToast();
  const internalData = use(NetworkInternalContext);
  const { eventBridge } = use(EventBridgeContext);
  const schemaPropMemo = useMemo(() => {
    if (schemaProp) {
      return { ...EMPTY_SCHEMA.schema, ...schemaProp };
    }

    switch (type) {
      case SCHEMA_TYPE_MAIN:
        return { ...EMPTY_SCHEMA.schema, ...internalData.schema };

      case SCHEMA_TYPE_PARTIAL:
      case SCHEMA_TYPE_TEMPLATE:
      default:
        return EMPTY_SCHEMA.schema;
    }
  }, [schemaProp]);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
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
  const { mutate, subscriptionManager } = use(NetworkContext);
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
    (to, data, dropPosition = 'inside', initialItems = {}, variables = [], fromSubscriptions = false) => {
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
    (element, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_ELEMENT, element, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaMoveElement = useCallback(
    (from, to, elementId, dropPosition = 'inside', fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_MOVE_ELEMENT, from, to, elementId, dropPosition, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaCloneElement = useCallback(
    (elementId, targetId, fromSubscriptions = false) => {
      const flat = get(schemaRef.current, 'flat');
      const elements = FlatMap.cloneElements(flat, elementId, targetId);
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
        dropPosition: 'inside',
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

  // Variables

  const schemaAddVariable = useCallback(
    async (variable, fromSubscriptions = false) => {
      dispatchSchema({ type: SchemaActions.SCHEMA_ADD_VARIABLE, variable, fromSubscriptions });
    },
    [dispatchSchema]
  );

  const schemaUpdateVariable = useCallback(
    (variable, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_VARIABLE, variable, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaRemoveVariable = useCallback(
    (name, fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_REMOVE_VARIABLE, name, fromSubscriptions }),
    [dispatchSchema]
  );

  // Others

  const schemaAddTemplate = useCallback(
    (
      to,
      data,
      dropPosition = 'inside',
      initialItems = {},
      templatePlatform = null,
      variables = [],
      fromSubscriptions = false
    ) => {
      dispatchSchema({
        type: SchemaActions.SCHEMA_ADD_TEMPLATE,
        to,
        data,
        dropPosition,
        initialItems,
        templatePlatform,
        variables,
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

        subscriptionManager.subscribe('SpaceAddPage', {}, data => {
          const { page } = get(data, 'data.SpaceAddPage', {});
          schemaAddPage(page, true);
        });

        subscriptionManager.subscribe('SpaceHomePage', {}, data => {
          const {
            page: { id }
          } = get(data, 'data.SpaceHomePage', {});
          schemaHomePage(id, true);
        });

        subscriptionManager.subscribe('SpaceUpdatePage', {}, data => {
          const { page } = get(data, 'data.SpaceUpdatePage', {});
          schemaUpdatePage(page, true);
        });

        subscriptionManager.subscribe('SpaceRemovePage', {}, data => {
          const { pageId } = get(data, 'data.SpaceRemovePage', {});
          schemaRemovePage(pageId, true);
        });

        // Page Folders

        subscriptionManager.subscribe('SpaceAddPageFolder', {}, data => {
          const { pageFolder } = get(data, 'data.SpaceAddPageFolder', {});
          schemaAddPageFolder(pageFolder, true);
        });

        subscriptionManager.subscribe('SpaceUpdatePageFolder', {}, data => {
          const { pageFolder } = get(data, 'data.SpaceUpdatePageFolder', {});
          schemaUpdatePageFolder(pageFolder, true);
        });

        subscriptionManager.subscribe('SpaceRemovePageFolder', {}, data => {
          const { pageFolderId } = get(data, 'data.SpaceRemovePageFolder', {});
          schemaRemovePageFolder(pageFolderId, true);
        });

        // Variables

        subscriptionManager.subscribe('SpaceAddVariable', {}, data => {
          const { variable } = get(data, 'data.SpaceAddVariable', {});
          schemaAddVariable(variable, true);
        });

        subscriptionManager.subscribe('SpaceUpdateVariable', {}, data => {
          const { variable } = get(data, 'data.SpaceUpdateVariable', {});
          schemaUpdateVariable(variable, true);
        });

        subscriptionManager.subscribe('SpaceRemoveVariable', {}, data => {
          const { name } = get(data, 'data.SpaceRemoveVariable', {});
          schemaRemoveVariable(name, true);
        });

        // Others

        subscriptionManager.subscribe('SpaceUpdateSettings', {}, data => {
          const { value, path } = get(data, 'data.SpaceUpdateSettings', {});
          schemaUpdateSettings(value, path, true);
        });
      }

      // Elements

      subscriptionManager.subscribe('SpaceAddElement', {}, data => {
        const { element, to, dropPosition, initialItems = [], variables = [] } = get(data, 'data.SpaceAddElement', {});
        schemaAddElement(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          variables,
          true
        );
      });

      subscriptionManager.subscribe('SpaceUpdateElement', {}, data => {
        const { element } = get(data, 'data.SpaceUpdateElement', {});
        schemaUpdateElement(element, true);
      });

      subscriptionManager.subscribe('SpaceRemoveElement', {}, data => {
        const { elementId } = get(data, 'data.SpaceRemoveElement', {});
        schemaRemoveElement(elementId, true);
      });

      subscriptionManager.subscribe('SpaceMoveElement', {}, data => {
        const { from, to, elementId, dropPosition } = get(data, 'data.SpaceMoveElement', {});
        schemaMoveElement(from, to, elementId, dropPosition, true);
      });

      subscriptionManager.subscribe('SpaceCloneElement', {}, data => {
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

      subscriptionManager.subscribe('SpaceUpdated', {}, data => {
        const { schema } = get(data, 'data.SpaceUpdated', {});
        schemaUpdate(schema, true);
      });

      subscriptionManager.subscribe('SpaceAddTemplate', {}, data => {
        const {
          element,
          styles,
          to,
          dropPosition,
          initialItems = [],
          variables = []
        } = get(data, 'data.SpaceAddTemplate', {});
        schemaAddTemplate(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          styles,
          variables,
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
        schemaAddVariable,
        schemaUpdateVariable,
        schemaRemoveVariable,
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
    schemaAddVariable,
    schemaUpdateVariable,
    schemaRemoveVariable,
    schemaAddTemplate,
    schemaUpdateSettings
  ]);

  const mainSchemaValueMemo = useMemo(
    () => ({
      pages: get(schema, 'pages', []),
      pageDefinitions: pick(get(schema, 'flat', {}), get(schema, 'pages', [])),
      pageFolders: get(schema, 'pageFolders', []),
      settings: get(schema, 'settings', {}),
      variables: get(schema, 'variables', [])
    }),
    [schema.pages, schema.settings, schema.pageFolders, schema.variables, schema.flat]
  );

  const schemaSettings = useMemo(() => schema.settings, [schema.settings]);

  if (type === SCHEMA_TYPE_MAIN) {
    return (
      <SchemaMainContext value={mainSchemaValueMemo}>
        <SchemaSettingsContext value={schemaSettings}>
          <SchemaContext value={valueMemo}>{children}</SchemaContext>
        </SchemaSettingsContext>
      </SchemaMainContext>
    );
  }

  return <SchemaContext value={valueMemo}>{children}</SchemaContext>;
};

export default SchemaContextProvider;
