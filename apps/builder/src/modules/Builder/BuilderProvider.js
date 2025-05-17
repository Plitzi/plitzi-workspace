import React, { useCallback, use, useMemo, useState, useRef, useEffect } from 'react';
import get from 'lodash/get';
import set from 'lodash/set';
import pick from 'lodash/pick';
import noop from 'lodash/noop';
import camelCase from 'lodash/camelCase';
import { produce } from 'immer';
import useStateMemo from '@plitzi/plitzi-ui-components/hooks/useStateMemo';

import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import {
  EventBridgeModuleTypes,
  EventBridgeTypes,
  EventBridgeTypesPerModule
} from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import FlatMap from '@plitzi/sdk-schema/FlatMap';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';

import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import { RealTimeEventTypes } from '@pmodules/Network/helpers/EventTypes';
import { getInitialItems } from '@pmodules/Elements/ElementHelper';

import { isInViewport } from '../../helpers/utils';
import AppContext from '@pmodules/App/AppContext';

export const BUILDER_MODE_NORMAL = 'normal';
export const BUILDER_MODE_TEMPLATE = 'template';
export const BUILDER_MODE_SEGMENT = 'segment';

/**
 * @param {{
 *   children: React.ReactNode;
 *   baseElementId: string;
 *   mode: string;
 *   schemaName: string;
 *   style: object;
 *   schema: object;
 *   onHandler: (event: string, data: any) => void;
 *   onBaseElementChange: (baseElementId: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderProvider = props => {
  const {
    children,
    baseElementId: baseElementIdProp = '',
    mode = BUILDER_MODE_NORMAL, // BUILDER_MODE_NORMAL | BUILDER_MODE_TEMPLATE | BUILDER_MODE_SEGMENT
    schemaName = '',
    style = emptyObject,
    schema = emptyObject,
    onHandler = noop,
    onBaseElementChange = noop
  } = props;
  const { displayMode } = use(AppContext);
  const [baseContext, setBaseContext] = useStateMemo(() => ({ baseElementId: baseElementIdProp }), [baseElementIdProp]);
  const { getComponentBuilderSettings, componentDefinitions, getComponent } = use(ComponentContext);
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);
  const [elementSelected, setElementSelected] = useState();
  const elementSelectedRef = useRef(elementSelected);
  elementSelectedRef.current = elementSelected;
  const [elementHovered, setElementHovered] = useState();
  const [selectorSelected, setSelectorSelected] = useState();
  const [styleSelector, setStyleSelector] = useState('base');
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
    (event, ...data) => {
      if (EventBridgeTypesPerModule[EventBridgeModuleTypes.BUILDER].includes(event)) {
        eventBridge.emit(EventBridgeModuleTypes.BUILDER, event, ...data);
      } else if (typeof onHandler === 'function' && onHandler !== noop) {
        onHandler(event, data);
      }
    },
    [mode, eventBridge, onHandler]
  );

  const getElement = useCallback(elementId => FlatMap.getElement(schemaRef.current.flat, elementId), []);

  const builderElementPermissions = useCallback(
    (element, path = '', defaultValue = undefined) => {
      if (!element) {
        return {};
      }
      const type = get(element, 'definition.type');
      if (!type) {
        return {};
      }

      let permissions = getComponentBuilderSettings(element.definition.type, path, defaultValue);
      if (!path && element.id === baseElementId) {
        permissions = { ...permissions, canDelete: false, canTemplate: false, canMove: false };
      }

      if (mode !== BUILDER_MODE_NORMAL && !path) {
        permissions.canTemplate = false;
      } else if (mode === BUILDER_MODE_NORMAL && path === 'canTemplate') {
        permissions = false;
      }

      if (!path) {
        permissions.overlay = { disable: false, theme: 'normal' };
      }

      return permissions;
    },
    [getComponentBuilderSettings, baseElementId, mode]
  );

  const setSelected = useCallback(
    (elementId, iframeDOM = undefined, force = false) => {
      setElementSelected(state => {
        if (force) {
          setSelectorSelected(undefined);
          setStyleSelector('base');

          return elementId;
        }

        if ((!state && !elementId) || (elementId && state === elementId)) {
          return state;
        }

        const element = get(schemaRef.current, `flat.${elementId}`);
        if (elementId && !element) {
          return state;
        }

        if (elementId) {
          const canSelect = builderElementPermissions(element, 'canSelect', true);
          if (!canSelect) {
            return state;
          }
        }

        if (supportRealTime) {
          subscriptionsPush({
            type: RealTimeEventTypes.ELEMENT,
            payload: {
              action: 'selected',
              rootId: baseElementId,
              id: elementId
            }
          });
        }

        if (elementId && iframeDOM) {
          const elementDOM = iframeDOM.contentWindow.document.querySelector(`[data-id="${elementId}"]`);
          if (elementDOM && !isInViewport(elementDOM)) {
            const { offsetParent, offsetTop } = elementDOM;
            offsetParent.scrollTop = offsetTop;
          }
        }

        const selector = get(element, 'definition.styleSelectors.base', '');
        const name = get(selector.split(' '), '0');
        setStyleSelector('base');
        if (name) {
          setSelectorSelected({ name, type: 'class' });
        } else {
          setSelectorSelected(undefined);
        }

        return elementId;
      });
    },
    [baseElementId, subscriptionsPush, builderElementPermissions]
  );

  const setHovered = useCallback(
    elementId => {
      setElementHovered(state => {
        if (
          (!state && !elementId) ||
          (elementId && state === elementId) ||
          (elementId && !get(schemaRef.current, `flat.${elementId}`))
        ) {
          return state;
        }

        if (supportRealTime) {
          subscriptionsPush({
            type: RealTimeEventTypes.ELEMENT,
            payload: {
              action: 'hovered',
              rootId: baseElementId,
              id: elementId
            }
          });
        }

        return elementId;
      });
    },
    [subscriptionsPush, baseElementId]
  );

  const builderSetBaseContext = useCallback(
    id => {
      if (!id) {
        id = baseElementIdProp;
      }

      const element = get(schemaRef.current, `flat.${id}`);
      if (!element) {
        return;
      }

      onBaseElementChange(id);
      setBaseContext(state => {
        setHovered(undefined);
        setSelectorSelected(undefined);
        setStyleSelector('base');
        if (state.baseElementId === id) {
          return state;
        }

        setSelected(undefined);

        return { baseElementId: id };
      });
    },
    [setSelected, setHovered, setBaseContext, baseElementIdProp]
  );

  const isDragAllowed = (element, parentElement, dataType, dropPosition) => {
    if (!element) {
      return true;
    }

    let { itemsAllowed, itemsNotAllowed } = builderElementPermissions(element);
    if (parentElement && dropPosition !== 'inside') {
      ({ itemsAllowed, itemsNotAllowed } = builderElementPermissions(parentElement));
    }

    if (itemsAllowed && itemsAllowed.length > 0 && !itemsAllowed.includes(dataType)) {
      return false;
    }

    if (itemsNotAllowed && itemsNotAllowed.includes(dataType)) {
      return false;
    }

    return true;
  };

  const drop = useCallback(
    async (type, data, dropPosition, toElementId, rootId) => {
      const toElement = getElement(toElementId);
      const toParentId = get(toElement, 'definition.parentId');
      const toParentElement = getElement(toParentId);
      if (!toElement || !type) {
        return false;
      }

      type = type.split('##');
      if (type.length !== 2 || (type[0] !== 'add' && type[0] !== 'move')) {
        return false;
      }

      if (dropPosition === 'inside' && !Array.isArray(get(toElement, 'definition.items'))) {
        return false;
      }

      if (type[1] === 'plitzi-template') {
        const dataCloned = FlatMap.cloneElements(
          { [data.baseElement.id]: data.baseElement, ...data.elements },
          data.baseElement.id,
          '',
          rootId,
          true
        );

        if (!dataCloned.item) {
          return false;
        }

        set(data.baseElement, 'definition.rootId', baseElementId);
        Object.values(data.elements).forEach(e => {
          set(data.elements, `${e.id}.definition.rootId`, baseElementId);
        });

        set(data.baseElement, 'definition.parentId', toElementId);
        builderHandler(
          EventBridgeTypes.SCHEMA_ADD_TEMPLATE,
          toElementId,
          pick(dataCloned.item, ['id', 'definition', 'attributes']),
          dropPosition,
          dataCloned.acum,
          data.style.platform,
          data.variables
        );

        return true;
      }

      try {
        if (
          !isDragAllowed(toElement, toParentElement, camelCase(type[1]), dropPosition) ||
          (data.id === toElement.id && dropPosition === 'inside')
        ) {
          return false;
        }

        if (type[0] === 'move') {
          const fromParentId = get(data.element, 'definition.parentId');
          builderHandler(EventBridgeTypes.SCHEMA_MOVE_ELEMENT, fromParentId, toElementId, data.id, dropPosition);
          setHovered(undefined);
        } else if (type[0] === 'add') {
          const element = {
            ...pick(data.element, ['attributes', 'definition']),
            id: data.id,
            definition: { ...data.element.definition, rootId }
          };

          const { initialItems } = builderElementPermissions(element);
          let itemsToAdd = {};
          if (initialItems) {
            itemsToAdd = getInitialItems(element.id, initialItems, componentDefinitions, baseElementId);
            set(element, 'definition.items', Object.keys(itemsToAdd.directItems));
          }

          builderHandler(
            EventBridgeTypes.SCHEMA_ADD_ELEMENT,
            toElementId,
            pick(element, ['id', 'attributes', 'definition']),
            dropPosition,
            itemsToAdd.items,
            get(data, 'variables', [])
          );
          setSelected(data.id, undefined, true);
        }
      } catch (err) {
        return false;
      }

      return true;
    },
    [builderHandler, getElement, builderElementPermissions, baseElementId, setSelected]
  );

  const setVisibility = useCallback(
    (elementId, visibility) => {
      const element = getElement(elementId);
      if (!element) {
        return;
      }

      builderHandler(
        EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
        produce(element, draft => {
          set(draft, 'definition.initialState.visibility', visibility);
        })
      );
    },
    [getElement, builderHandler]
  );

  const getBaseElement = useCallback(
    otherBaseElementId => {
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

      return {
        data: element,
        Plugin: getComponent(type)
      };
    },
    [baseElementId, getComponent, getElement]
  );

  const updateElement = useCallback(
    (elementId, attributeKey, attributeValue, category = 'attributes') => {
      const element = getElement(elementId);
      if (!element || elementId !== elementSelectedRef.current) {
        return;
      }

      builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, {
        ...element,
        [category]: { ...element[category], [attributeKey]: attributeValue }
      });
    },
    [getElement]
  );

  useEffect(() => {
    if (baseElementId) {
      setHovered(undefined);
      setSelectorSelected(undefined);
      setStyleSelector('base');
      setSelected(undefined);
      if (baseContext.baseElementId !== baseElementId && mode !== BUILDER_MODE_NORMAL) {
        builderSetBaseContext(baseElementId);
      }
    }
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
    () => ({ style, selectorSelected, displayMode, setSelectorSelected, styleSelector, setStyleSelector }),
    [style, selectorSelected, displayMode, setSelectorSelected, styleSelector, setStyleSelector]
  );

  const events = useMemo(
    () => ({ builderSetBaseContext, builderSetSelected: setSelected, builderSetHovered: setHovered }),
    [builderSetBaseContext, setSelected, setHovered]
  );
  useEventBridge(EventBridgeModuleTypes.BUILDER, events);

  const builderValue = useMemo(
    () => ({
      mode,
      schemaName,
      setMultiPagesMode,
      multiPagesMode,
      hasMultiPages: pages.length > 1 && mode === BUILDER_MODE_NORMAL,
      baseContext,
      baseElementIdOriginal: baseElementIdProp,
      builderSetBaseContext,
      builderElementPermissions,
      builderHandler,
      updateElement
    }),
    [
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
      updateElement
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
