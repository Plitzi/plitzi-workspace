/* eslint-disable @typescript-eslint/no-dynamic-delete */
import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import get from 'lodash/get';
import pick from 'lodash/pick';
import { useMemo, useRef, useCallback, use, useEffect } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap, { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import SchemaReducer, { SchemaActions } from './SchemaReducer';

import type { SchemaReducerActions } from './SchemaReducer';
import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type {
  BuilderNetworkContextValue,
  DropPosition,
  Element,
  PageFolder,
  Schema,
  SchemaRaw,
  SchemaVariable,
  Style
} from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { ReactNode } from 'react';

export type SchemaContextProviderProps = {
  children?: ReactNode;
  type?: 'main' | 'partial' | 'template' | 'segment';
  schema?: Schema;
  includeSubscriptions?: boolean;
};

const SchemaContextProvider = ({
  children,
  type = 'main',
  schema: schemaProp,
  includeSubscriptions = true
}: SchemaContextProviderProps) => {
  const internalData = use(NetworkInternalContext);
  const { eventBridge } = use(EventBridgeContext);
  const schemaPropMemo = useMemo(() => {
    if (schemaProp) {
      return { ...EMPTY_SCHEMA.schema, ...schemaProp };
    }

    switch (type) {
      case 'main':
        return { ...EMPTY_SCHEMA.schema, ...internalData.schema };

      case 'partial':
      case 'template':
      default:
        return EMPTY_SCHEMA.schema;
    }
  }, [internalData.schema, schemaProp, type]);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  const [schema, dispatchSchema] = useReducerWithMiddleware(SchemaReducer, schemaPropMemo, [
    {
      middleware: undoableMiddleware as ReducerMiddlewareCallback<Schema, [action: SchemaReducerActions]>,
      filterCallback: action => !action.fromSubscriptions && type === 'main'
    },
    {
      middleware: enqueueMiddleware as ReducerMiddlewareCallback<Schema, [action: SchemaReducerActions]>,
      filterCallback: action => !action.fromSubscriptions && type === 'main'
    }
  ]);
  const schemaRef = useRef(schema);
  const { mutate, subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  schemaRef.current = schema;

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

  const schemaMoveElement = useCallback(
    (from: string, to: string, elementId: string, dropPosition: DropPosition = 'inside', fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_MOVE_ELEMENT, from, to, elementId, dropPosition, fromSubscriptions }),
    [dispatchSchema]
  );

  const schemaCloneElement = useCallback(
    (elementId: string, targetId?: string, fromSubscriptions = false) => {
      const flat = get(schemaRef.current, 'flat');
      const elements = FlatMap.cloneElements(flat, elementId, targetId);
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
    [dispatchSchema]
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
      templatePlatform?: Style['platform'],
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
        fromSubscriptions
      });

      void eventBridge.emit('main', 'styleAddTemplate', templatePlatform, true);
    },
    [dispatchSchema, eventBridge]
  );

  const schemaUpdateSettings = useCallback(
    (value: string | number | boolean, path: string = '', fromSubscriptions = false) =>
      dispatchSchema({ type: SchemaActions.SCHEMA_UPDATE_SETTINGS, value, path, fromSubscriptions }),
    [dispatchSchema]
  );

  useEffect(() => {
    if (includeSubscriptions && type === 'main') {
      // Pages

      subscriptionManager.subscribe('SpaceAddPage', {}, data => {
        const { page } = get(data, 'data.SpaceAddPage', {}) as { page: Element };
        void schemaAddPage(page, true);
      });

      subscriptionManager.subscribe('SpaceHomePage', {}, data => {
        const { page } = get(data, 'data.SpaceHomePage', {}) as { page: Element };
        schemaHomePage(page.id, true);
      });

      subscriptionManager.subscribe('SpaceUpdatePage', {}, data => {
        const { page } = get(data, 'data.SpaceUpdatePage', {}) as { page: Element };
        schemaUpdatePage(page, true);
      });

      subscriptionManager.subscribe('SpaceRemovePage', {}, data => {
        const { pageId } = get(data, 'data.SpaceRemovePage', {}) as { pageId: string };
        schemaRemovePage(pageId, true);
      });

      // Page Folders

      subscriptionManager.subscribe('SpaceAddPageFolder', {}, data => {
        const { pageFolder } = get(data, 'data.SpaceAddPageFolder', {}) as { pageFolder: PageFolder };
        void schemaAddPageFolder(pageFolder, true);
      });

      subscriptionManager.subscribe('SpaceUpdatePageFolder', {}, data => {
        const { pageFolder } = get(data, 'data.SpaceUpdatePageFolder', {}) as { pageFolder: PageFolder };
        schemaUpdatePageFolder(pageFolder, true);
      });

      subscriptionManager.subscribe('SpaceRemovePageFolder', {}, data => {
        const { pageFolderId } = get(data, 'data.SpaceRemovePageFolder', {}) as { pageFolderId: string };
        schemaRemovePageFolder(pageFolderId, true);
      });

      // Variables

      subscriptionManager.subscribe('SpaceAddVariable', {}, data => {
        const { variable } = get(data, 'data.SpaceAddVariable', {}) as { variable: SchemaVariable };
        schemaAddVariable(variable, true);
      });

      subscriptionManager.subscribe('SpaceUpdateVariable', {}, data => {
        const { variable } = get(data, 'data.SpaceUpdateVariable', {}) as { variable: SchemaVariable };
        schemaUpdateVariable(variable, true);
      });

      subscriptionManager.subscribe('SpaceRemoveVariable', {}, data => {
        const { name } = get(data, 'data.SpaceRemoveVariable', {}) as { name: string };
        schemaRemoveVariable(name, true);
      });

      // Others

      subscriptionManager.subscribe('SpaceUpdateSettings', {}, data => {
        const { value, path } = get(data, 'data.SpaceUpdateSettings', {}) as {
          path?: string;
          value: number | string | boolean;
        };
        schemaUpdateSettings(value, path, true);
      });

      // Elements

      subscriptionManager.subscribe('SpaceAddElement', {}, data => {
        const {
          element,
          to,
          dropPosition,
          initialItems = [],
          variables = []
        } = get(data, 'data.SpaceAddElement', {}) as {
          to: string;
          element: Element;
          dropPosition: DropPosition;
          initialItems?: Element[];
          variables?: SchemaVariable[];
        };
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
        const { element } = get(data, 'data.SpaceUpdateElement', {}) as { element: Element };
        schemaUpdateElement(element, true);
      });

      subscriptionManager.subscribe('SpaceRemoveElement', {}, data => {
        const { elementId } = get(data, 'data.SpaceRemoveElement', {}) as { elementId: string };
        schemaRemoveElement(elementId, true);
      });

      subscriptionManager.subscribe('SpaceMoveElement', {}, data => {
        const { from, to, elementId, dropPosition } = get(data, 'data.SpaceMoveElement', {}) as {
          from: string;
          to: string;
          elementId: string;
          dropPosition: DropPosition;
        };
        schemaMoveElement(from, to, elementId, dropPosition, true);
      });

      subscriptionManager.subscribe('SpaceCloneElement', {}, data => {
        const {
          element,
          to,
          dropPosition,
          initialItems = []
        } = get(data, 'data.SpaceCloneElement', {}) as {
          to: string;
          element: Element;
          dropPosition: DropPosition;
          initialItems: Element[];
        };
        schemaAddElement(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          [], // variables, @todo: implement this in the server
          true
        );
      });

      // Others

      subscriptionManager.subscribe('SpaceUpdated', {}, data => {
        const { schema } = get(data, 'data.SpaceUpdated', {}) as { schema: SchemaRaw };
        schemaUpdate(schema, true);
      });

      subscriptionManager.subscribe('SpaceAddTemplate', {}, data => {
        const {
          element,
          stylePlatform,
          to,
          dropPosition,
          initialItems = [],
          variables = []
        } = get(data, 'data.SpaceAddTemplate', {}) as {
          element: Element;
          stylePlatform: Style['platform'];
          to: string;
          dropPosition: DropPosition;
          initialItems?: Element[];
          variables?: SchemaVariable[];
        };
        schemaAddTemplate(
          to,
          element,
          dropPosition,
          initialItems.reduce((acum, item) => ({ ...acum, [item.id]: item }), {}),
          stylePlatform,
          variables,
          true
        );
      });
    }

    return () => {
      if (includeSubscriptions && type === 'main') {
        subscriptionManager.unsubscribe([
          'SpaceAddPage',
          'SpaceHomePage',
          'SpaceUpdatePage',
          'SpaceRemovePage',
          'SpaceAddPageFolder',
          'SpaceUpdatePageFolder',
          'SpaceRemovePageFolder',
          'SpaceAddVariable',
          'SpaceUpdateVariable',
          'SpaceRemoveVariable',
          'SpaceUpdateSettings',
          'SpaceAddElement',
          'SpaceUpdateElement',
          'SpaceRemoveElement',
          'SpaceMoveElement',
          'SpaceCloneElement',
          'SpaceUpdated',
          'SpaceAddTemplate'
        ]);
      }
    };
  }, [
    subscriptionManager,
    includeSubscriptions,
    type,
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

  useEventBridge('main', mainEvents, undefined, undefined, type !== 'main');
  // End When type = 'main'

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

  useEventBridge('main', events);

  const valueMemo = useMemo(() => {
    if (type === 'main') {
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
    type,
    dispatchSchema,
    schema,
    schemaUpdate,
    schemaAddElement,
    schemaUpdateElement,
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

  const pageDefinitions = useValueMemo<Record<string, Element>>(
    pick(get(schema, 'flat', {} as Record<string, Element>), get(schema, 'pages', [])),
    'soft'
  );
  const mainSchemaValueMemo = useMemo(
    () => ({
      pages: get(schema, 'pages', []) as string[],
      pageDefinitions,
      pageFolders: get(schema, 'pageFolders', []),
      settings: get(schema, 'settings', {}) as Schema['settings'],
      variables: get(schema, 'variables', []) as SchemaVariable[]
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.pages, schema.settings, schema.pageFolders, schema.variables, pageDefinitions]
  );

  const schemaSettings = useMemo(() => schema.settings, [schema.settings]);

  if (type === 'main') {
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
