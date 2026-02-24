import { get, pick, set } from '@plitzi/plitzi-ui/helpers';
import useStateMemo from '@plitzi/plitzi-ui/hooks/useStateMemo';
import { produce } from 'immer';
import { useCallback, use, useMemo, useState, useRef, useEffect } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypesPerModule } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import AppContext from '@pmodules/App/AppContext';
import { getInitialItems } from '@pmodules/Elements/ElementHelper';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

import { isInViewport } from '../../helpers/utils';

import type { EventBridgeCallback } from '@plitzi/sdk-event-bridge';
import type {
  BuilderContextValue,
  Element,
  EventBridgeEvent,
  PluginBuilder,
  Schema,
  Style,
  DropPosition,
  BuilderNetworkContextValue,
  StyleThemeMode
} from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';

export type BuilderProviderProps = {
  children: React.ReactNode;
  baseElementId: string;
  mode?: 'normal' | 'template' | 'segment';
  schemaName?: string;
  style: Style;
  schema: Schema;
  onHandler?: (event: EventBridgeEvent, data: unknown[]) => void;
  onBaseElementChange?: (baseElementId: string) => void;
};

const BuilderProvider = ({
  children,
  baseElementId: baseElementIdProp = '',
  mode = 'normal',
  schemaName = '',
  style,
  schema,
  onHandler,
  onBaseElementChange
}: BuilderProviderProps) => {
  const { displayMode } = use(AppContext);
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const [baseContext, setBaseContext] = useStateMemo(() => ({ baseElementId: baseElementIdProp }), [baseElementIdProp]);
  const { componentDefinitions, getComponent } = use(ComponentContext);
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);
  const [elementSelected, setElementSelected] = useState<string | undefined>(undefined);
  const elementSelectedRef = useRef(elementSelected);
  elementSelectedRef.current = elementSelected;
  const [elementHovered, setElementHovered] = useState<string | undefined>(undefined);
  const [selector, setSelector] = useState<string | undefined>();
  const [styleSelector, setStyleSelector] = useState<string | undefined>('base');
  const [theme, setTheme] = useState<StyleThemeMode>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    return 'system';
  });
  const { baseElementId } = baseContext;
  const [multiPagesMode, setMultiPagesMode] = useState(false);
  const pages = useMemo(() => get(schema, 'pages', []), [schema]);

  // Manage Refs

  const schemaRef = useRef(schema);
  const styleRef = useRef(style);
  schemaRef.current = schema;
  styleRef.current = style;

  // Builder Methods

  const { eventBridge } = use(EventBridgeContext);

  const builderHandler = useCallback(
    (event: EventBridgeEvent, ...data: unknown[]) => {
      if (EventBridgeTypesPerModule.builder.includes(event)) {
        void eventBridge.emit('builder', event, ...data);
      } else if (typeof onHandler === 'function') {
        onHandler(event, data);
      }
    },
    [eventBridge, onHandler]
  );

  const getElement = useCallback(
    (elementId?: string) => (elementId ? FlatMap.getElement(schemaRef.current.flat, elementId) : undefined),
    []
  );

  const builderElementPermissions = useCallback(
    (element: Element, path?: string, defaultValue: boolean = true) => {
      const type = get(element, 'definition.type');
      if (!type && !path) {
        return {};
      }

      if (!type && path) {
        return defaultValue;
      }

      let permissions = get(componentDefinitions, `${type}.content.builder`, {}) as PluginBuilder;
      if (!path && element.id === baseElementId) {
        permissions = { ...permissions, canDelete: false, canTemplate: false, canMove: false };
      }

      if (mode !== 'normal' && !path) {
        permissions.canTemplate = false;
      } else if (mode === 'normal' && path === 'canTemplate') {
        return false;
      }

      if (path) {
        return get(permissions, path, defaultValue);
      }

      return permissions;
    },
    [componentDefinitions, baseElementId, mode]
  ) as BuilderContextValue['builderElementPermissions'];

  const setSelected = useCallback(
    (elementId?: string, iframeDOM?: HTMLIFrameElement | null, force = false) => {
      setElementSelected(state => {
        if (force) {
          return elementId;
        }

        if ((!state && !elementId) || (elementId && state === elementId)) {
          return state;
        }

        const element = get(schemaRef.current, `flat.${elementId}`);
        if (!elementId || !(element as Element | undefined)) {
          return undefined;
        }

        if (elementId) {
          const canSelect = builderElementPermissions(element as Element, 'canSelect');
          if (!canSelect) {
            return state;
          }
        }

        if (elementId && iframeDOM) {
          const elementDOM: HTMLElement | undefined | null = iframeDOM.contentWindow?.document.querySelector(
            `[data-id="${elementId}"]`
          );
          if (elementDOM && !isInViewport(elementDOM) && elementDOM.offsetParent) {
            const { offsetParent, offsetTop } = elementDOM;
            offsetParent.scrollTop = offsetTop;
          }
        }

        return elementId;
      });
    },
    [builderElementPermissions]
  );

  const setHovered = useCallback((elementId?: string) => {
    setElementHovered(state => {
      if (
        (!state && !elementId) ||
        (elementId && state === elementId) ||
        (elementId && !(get(schemaRef.current, `flat.${elementId}`) as Element | undefined))
      ) {
        return state;
      }

      return elementId;
    });
  }, []);

  const builderSetBaseContext = useCallback(
    (id?: string) => {
      if (!id) {
        id = baseElementIdProp;
      }

      const element = get(schemaRef.current, `flat.${id}`);
      if (!(element as Element | undefined)) {
        return;
      }

      onBaseElementChange?.(id);
      setBaseContext(state => {
        setHovered(undefined);
        if (state.baseElementId === id) {
          return state;
        }

        setSelected(undefined);

        return { baseElementId: id };
      });
    },
    [onBaseElementChange, setBaseContext, baseElementIdProp, setHovered, setSelected]
  );

  const isDragAllowed = (
    element?: Element,
    parentElement?: Element,
    dataType?: string,
    dropPosition?: DropPosition
  ) => {
    if (!element) {
      return true;
    }

    let { itemsAllowed, itemsNotAllowed } = builderElementPermissions(element);
    if (parentElement && dropPosition !== 'inside') {
      ({ itemsAllowed, itemsNotAllowed } = builderElementPermissions(parentElement));
    }

    if (itemsAllowed && itemsAllowed.length > 0 && dataType && !itemsAllowed.includes(dataType)) {
      return false;
    }

    if (itemsNotAllowed && dataType && itemsNotAllowed.includes(dataType)) {
      return false;
    }

    return true;
  };

  const drop = useCallback(
    (
      type: string,
      data:
        | { elements: Record<string, Element>; baseElement?: Element; style: Style; variables: Schema['variables'] }
        | { id: string; element: Element }
        | { id: string; parentId: string; element: Element },
      dropPosition: DropPosition,
      toElementId: string,
      rootId?: string
    ) => {
      const toElement = getElement(toElementId);
      if (!toElement) {
        return false;
      }

      const toParentId = get(toElement, 'definition.parentId');
      const toParentElement = getElement(toParentId);
      if (!type) {
        return false;
      }

      const typeArr = type.split('##');
      if (typeArr.length !== 2 || (typeArr[0] !== 'add' && typeArr[0] !== 'move')) {
        return false;
      }

      if (dropPosition === 'inside' && !Array.isArray(get(toElement, 'definition.items'))) {
        return false;
      }

      if (typeArr[1] === 'plitzi-template') {
        const dataParsed = data as {
          elements: Record<string, Element>;
          baseElement?: Element;
          style: Style;
          variables: Schema['variables'];
        };

        if (!dataParsed.baseElement) {
          return false;
        }

        const dataCloned = FlatMap.cloneElements(
          { [dataParsed.baseElement.id]: dataParsed.baseElement, ...dataParsed.elements },
          dataParsed.baseElement.id,
          '',
          rootId,
          true
        );

        if (!dataCloned.item) {
          return false;
        }

        set(dataParsed.baseElement, 'definition.rootId', baseElementId);
        Object.values(dataParsed.elements).forEach((el: Element) => {
          set(dataParsed.elements, `${el.id}.definition.rootId`, baseElementId);
        });

        set(dataParsed.baseElement, 'definition.parentId', toElementId);
        builderHandler(
          'schemaAddTemplate',
          toElementId,
          pick(dataCloned.item, ['id', 'definition', 'attributes']),
          dropPosition,
          dataCloned.acum,
          dataParsed.style,
          dataParsed.variables
        );

        return true;
      }

      try {
        const dataParsed = data as {
          id: string;
          element: Element;
          variables?: string[];
        };

        if (
          !isDragAllowed(toElement, toParentElement, typeArr[1], dropPosition) ||
          (dataParsed.id === toElement.id && dropPosition === 'inside')
        ) {
          return false;
        }

        if (typeArr[0] === 'move') {
          const fromParentId = get(dataParsed.element, 'definition.parentId');
          builderHandler('schemaMoveElement', fromParentId, toElementId, dataParsed.id, dropPosition);
          setHovered(undefined);
        } else if ((typeArr[0] as string) === 'add') {
          const element = {
            ...pick(dataParsed.element, ['attributes', 'definition']),
            id: dataParsed.id,
            definition: { ...dataParsed.element.definition, rootId }
          };

          const initialItems = get(componentDefinitions, `${typeArr[1]}.initialItems`, undefined);
          let itemsToAdd: ReturnType<typeof getInitialItems> = { directItems: {}, items: {} };
          if (initialItems && initialItems.length > 0) {
            itemsToAdd = getInitialItems(element.id, initialItems, componentDefinitions, baseElementId);
            set(element, 'definition.items', Object.keys(itemsToAdd.directItems));
          }

          builderHandler(
            'schemaAddElement',
            toElementId,
            pick(element, ['id', 'attributes', 'definition']),
            dropPosition,
            itemsToAdd.items,
            get(dataParsed, 'variables', [])
          );
          setSelected(dataParsed.id, undefined, true);
        }
      } catch {
        return false;
      }

      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getElement, baseElementId, builderHandler, setHovered, componentDefinitions, setSelected]
  );

  const elementAsTemplate = useCallback(
    async (
      cdnIdentifier: string,
      schema: Schema,
      style: Style,
      name: string,
      description: string,
      element: Element
    ) => {
      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(schema, style, element.id);
      if (!elements.item) {
        return;
      }

      const jsonData = {
        definition: { name, description, baseElementId: elements.item.id },
        schema: { flat: elements.acum, variables },
        style: { ...elementsStyle, cache: generateCache(elementsStyle) }
      };

      // const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
      const file = new File([JSON.stringify(jsonData, null, 2)], `${name}.json`, {
        type: 'application/json',
        lastModified: Date.now()
      });
      await mutate(
        'SpaceAddResource',
        { cdnIdentifier, resource: file, type: 'template', compression: undefined },
        false,
        false,
        { customFetch: true }
      );
    },
    [mutate]
  );

  const setVisibility = useCallback(
    (elementId: string, visibility: boolean) => {
      const element = getElement(elementId);
      if (!element) {
        return;
      }

      builderHandler(
        'schemaUpdateElement',
        produce(element, draft => {
          set(draft, 'definition.initialState.visibility', visibility);
        })
      );
    },
    [getElement, builderHandler]
  );

  const getBaseElement = useCallback(
    (otherBaseElementId?: string) => {
      const element = getElement(otherBaseElementId ?? baseElementId);
      if (!element) {
        return undefined;
      }

      const {
        definition: { type, items }
      } = element;
      if (!items) {
        return undefined;
      }

      return { data: element, Plugin: getComponent(type) };
    },
    [baseElementId, getComponent, getElement]
  );

  const updateElement = useCallback(
    (
      elementId: string,
      attributeKey: string,
      attributeValue: unknown,
      category: 'attributes' | 'definition' = 'attributes'
    ) => {
      if (!elementId) {
        return;
      }

      const element = getElement(elementId);
      if (!element || elementId !== elementSelectedRef.current) {
        return;
      }

      builderHandler('schemaUpdateElement', {
        ...element,
        [category]: { ...element[category], [attributeKey]: attributeValue }
      });
    },
    [builderHandler, getElement]
  );

  useEffect(() => {
    if (!supportRealTime) {
      return;
    }

    subscriptionsPush({
      type: RTEvent.ELEMENT,
      payload: { action: 'selected', rootId: baseElementId, id: elementSelected }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementSelected, subscriptionsPush, supportRealTime]);

  useEffect(() => {
    if (!supportRealTime) {
      return;
    }

    subscriptionsPush({
      type: RTEvent.ELEMENT,
      payload: { action: 'hovered', rootId: baseElementId, id: elementHovered }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementHovered, subscriptionsPush, supportRealTime]);

  useEffect(() => {
    if (baseElementId) {
      setHovered(undefined);
      setSelected(undefined);
      if (baseContext.baseElementId !== baseElementId && mode !== 'normal') {
        builderSetBaseContext(baseElementId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseElementId, mode]);

  const selectedValueMemo = useMemo(() => ({ elementSelected, setSelected }), [elementSelected, setSelected]);

  const hoveredValueMemo = useMemo(() => ({ elementHovered, setHovered }), [elementHovered, setHovered]);

  const builderSchemaValueMemo = useMemo(
    () => ({
      schema,
      builderGetBaseElement: getBaseElement,
      builderDropElement: drop,
      builderSetElementVisibility: setVisibility
    }),
    [getBaseElement, drop, setVisibility, schema]
  );

  const builderStyleValueMemo = useMemo(
    () => ({ style, displayMode, selector, setSelector, styleSelector, setStyleSelector }),
    [style, displayMode, selector, styleSelector]
  );

  const events = useMemo<Record<string, EventBridgeCallback>>(
    () => ({ builderSetBaseContext, builderSetSelected: setSelected, builderSetHovered: setHovered }),
    [builderSetBaseContext, setSelected, setHovered]
  );
  useEventBridge('builder', events);

  const builderValue = useMemo(
    () => ({
      theme,
      setTheme,
      mode,
      schemaName,
      setMultiPagesMode,
      multiPagesMode,
      hasMultiPages: pages.length > 1 && mode === 'normal',
      baseContext,
      baseElementIdOriginal: baseElementIdProp,
      builderSetBaseContext,
      builderElementPermissions,
      builderHandler,
      updateElement,
      elementAsTemplate
    }),
    [
      theme,
      setTheme,
      mode,
      schemaName,
      setMultiPagesMode,
      multiPagesMode,
      pages.length,
      baseContext,
      baseElementIdProp,
      builderSetBaseContext,
      builderElementPermissions,
      builderHandler,
      updateElement,
      elementAsTemplate
    ]
  );

  return (
    <BuilderSchemaContext value={builderSchemaValueMemo}>
      <BuilderStyleContext value={builderStyleValueMemo}>
        <BuilderSelectedContext value={selectedValueMemo}>
          <BuilderHoveredContext value={hoveredValueMemo}>
            <BuilderContext value={builderValue}>{children}</BuilderContext>
          </BuilderHoveredContext>
        </BuilderSelectedContext>
      </BuilderStyleContext>
    </BuilderSchemaContext>
  );
};

export default BuilderProvider;
