import { get, pick, set } from '@plitzi/plitzi-ui/helpers';
import useStateMemo from '@plitzi/plitzi-ui/hooks/useStateMemo';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { produce } from 'immer';
import { useCallback, use, useMemo, useState, useEffect } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypesPerModule } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { isInViewport } from '@plitzi/sdk-shared/helpers/utils';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import { generateCache } from '@plitzi/sdk-style/StyleHelper';
import { getInitialItems } from '@pmodules/Elements/ElementHelper';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';

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
  StyleThemeMode,
  BuilderQueriesMap,
  BuilderMutationsMap,
  BuilderState
} from '@plitzi/sdk-shared';

export type BuilderProviderProps = {
  children: React.ReactNode;
  baseElementId: string;
  mode?: 'normal' | 'template' | 'segment';
  schemaName?: string;

  onHandler?: (event: EventBridgeEvent, data: unknown[]) => void;
  onBaseElementChange?: (baseElementId: string) => void;
};

const BuilderProvider = ({
  children,
  baseElementId: baseElementIdProp = '',
  mode = 'normal',
  schemaName = '',
  onHandler,
  onBaseElementChange
}: BuilderProviderProps) => {
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const [baseContext, setBaseContext] = useStateMemo(() => ({ baseElementId: baseElementIdProp }), [baseElementIdProp]);
  const { componentDefinitions, getComponent } = use(ComponentContext);
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);
  const [theme, setTheme] = useStorage<StyleThemeMode>('builder-state.theme-builder', 'light', 'localStorage');
  const { baseElementId } = baseContext;
  const [multiPagesMode, setMultiPagesMode] = useState(false);
  const { useStore, useStoreSync, useStoreGetter } = createStoreHook<BuilderState>();
  const [[pages, elementHovered, elementSelected], , setElementHovered, setElementSelected] = useStore([
    'schema.pages',
    'elementHovered',
    'elementSelected'
  ]);
  const [getElement, getElementSelected] = useStoreGetter(['schema.flat', 'elementSelected']);

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

  const builderElementPermissions = useCallback(
    (element: Element, path?: string, defaultValue: boolean = true) => {
      const type = get(element, 'definition.type');
      if (!type && !path) {
        return {};
      }

      if (!type && path) {
        return defaultValue;
      }

      let permissions = get(componentDefinitions.current, `${type}.content.builder`, {}) as PluginBuilder;
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

        const element = elementId ? getElement(elementId) : undefined;
        if (!elementId || !element) {
          return undefined;
        }

        if (elementId) {
          const canSelect = builderElementPermissions(element, 'canSelect');
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
    [builderElementPermissions, getElement, setElementSelected]
  );

  const setHovered = useCallback(
    (elementId?: string) => {
      setElementHovered(state => {
        if (
          (!state && !elementId) ||
          (elementId && state === elementId) ||
          (elementId && !getElement(elementId, undefined))
        ) {
          return state;
        }

        return elementId;
      });
    },
    [getElement, setElementHovered]
  );

  const builderSetBaseContext = useCallback(
    (id?: string) => {
      if (!id) {
        id = baseElementIdProp;
      }

      const element = getElement(id, undefined);
      if (!element) {
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
    [getElement, onBaseElementChange, setBaseContext, baseElementIdProp, setHovered, setSelected]
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
      const toElement = getElement(toElementId, undefined);
      if (!toElement) {
        return false;
      }

      const toParentId = get(toElement, 'definition.parentId');
      const toParentElement = toParentId ? getElement(toParentId) : undefined;
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

      if (typeArr[1]) {
        try {
          const dataParsed = data as {
            id: string;
            element: Element;
            variables?: string[];
          };

          const type = get(dataParsed, 'element.definition.type', '');
          if (!type) {
            return false;
          }

          if (
            !isDragAllowed(toElement, toParentElement, type, dropPosition) ||
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

            const initialItems = get(componentDefinitions.current, `${type}.initialItems`, undefined);
            let itemsToAdd: ReturnType<typeof getInitialItems> = { directItems: {}, items: {} };
            if (initialItems && initialItems.length > 0) {
              itemsToAdd = getInitialItems(element.id, initialItems, componentDefinitions.current, baseElementId);
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

          return true;
        } catch {
          return false;
        }
      }

      return false;
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
      const element = getElement(elementId, undefined);
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
      if (!baseElementId && !baseElementId) {
        return undefined;
      }

      const element = getElement(otherBaseElementId ?? baseElementId, undefined);
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

      const element = getElement(elementId, undefined);
      if (!element || elementId !== getElementSelected()) {
        return;
      }

      builderHandler('schemaUpdateElement', {
        ...element,
        [category]: { ...element[category], [attributeKey]: attributeValue }
      });
    },
    [builderHandler, getElement, getElementSelected]
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

  useStoreSync(
    ['elementHovered', 'setHovered', 'elementSelected', 'setSelected'],
    [elementHovered, () => setHovered, elementSelected, () => setSelected]
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
      elementAsTemplate,
      builderGetBaseElement: getBaseElement,
      builderDropElement: drop,
      builderSetElementVisibility: setVisibility
    }),
    [
      theme,
      mode,
      schemaName,
      multiPagesMode,
      pages.length,
      baseContext,
      baseElementIdProp,
      setTheme,
      builderSetBaseContext,
      builderElementPermissions,
      builderHandler,
      updateElement,
      elementAsTemplate,
      getBaseElement,
      drop,
      setVisibility
    ]
  );

  return <BuilderContext value={builderValue}>{children}</BuilderContext>;
};

export default BuilderProvider;
