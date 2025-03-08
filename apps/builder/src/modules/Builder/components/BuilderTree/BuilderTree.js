// Packages
import React, { useCallback, use, useMemo, useRef } from 'react';
import get from 'lodash/get';
import Tree from '@plitzi/plitzi-ui/Tree';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Monorepo
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/BuilderSelectedContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/BuilderSchemaContext';

// Relatives
import BuilderTreeNodeControls from './BuilderTreeNodeControls';

const BuilderTree = ({ setDragTree }) => {
  const { componentDefinitions } = use(ComponentContext);
  const { elementHovered, setHovered: setHoverElement } = use(BuilderHoveredContext);
  const { elementSelected, setSelected: setSelectElement } = use(BuilderSelectedContext);
  const {
    builderDropElement,
    schema: { flat }
  } = use(BuilderSchemaContext);
  const flatRef = useRef(flat);
  flatRef.current = flat;
  const {
    builderHandler,
    builderElementPermissions,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const baseElement = useMemo(() => flat[baseElementId], [flat, baseElementId]);
  const [, setCache, getCache] = useCache();
  const openedCache = getCache('BuilderTree.openedCache', {});

  const isDragAllowed = useCallback(
    (id, dropPosition, parentId) => {
      const element = get(flatRef.current, id);
      const parentElement = get(flatRef.current, parentId);
      if (!element || (dropPosition !== 'inside' && !parentElement)) {
        return true;
      }

      const {
        definition: { type }
      } = element;

      let { itemsAllowed, itemsNotAllowed } = builderElementPermissions(element);
      if (itemsNotAllowed && dropPosition !== 'inside') {
        ({ itemsAllowed, itemsNotAllowed } = builderElementPermissions(parentElement));
      }

      if (itemsAllowed && itemsAllowed.length > 0 && !itemsAllowed.includes(type)) {
        return false;
      }

      if (itemsNotAllowed && itemsNotAllowed.includes(type)) {
        return false;
      }

      return true;
    },
    [builderElementPermissions]
  );

  const handleChange = useCallback(
    (action, data) => {
      switch (action) {
        case 'itemsOpened': {
          setCache(data, 'BuilderTree.openedCache');
          break;
        }

        case 'itemChanged': {
          const { item } = data;
          const element = get(flatRef.current, item.id);
          if (!element) {
            break;
          }

          builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, {
            ...element,
            definition: { ...element.definition, label: item.label }
          });
          break;
        }

        case 'itemDragged': {
          const { id, toId, dropPosition, event } = data;
          const element = get(flatRef.current, id);
          if (!element) {
            break;
          }

          const {
            definition: { type }
          } = element;
          if ((id && id === toId) || !id) {
            try {
              let data = event.dataTransfer.getData(event.dataTransfer.types[0]);
              data = JSON.parse(data);
              builderDropElement(`add##${type}`, data, dropPosition, toId, baseElementId);
            } catch (e) {
              // nothing here
            }
          } else {
            builderDropElement(`move##${type}`, { element, id: element.id }, dropPosition, toId, baseElementId);
          }

          break;
        }

        case 'itemHovered': {
          setHoverElement(data);
          break;
        }

        case 'itemSelected': {
          setSelectElement(data);
          break;
        }

        case 'isDragging': {
          setDragTree?.(data);
          break;
        }

        default:
      }
    },
    [setHoverElement, setSelectElement, setCache, builderDropElement, baseElementId]
  );

  const nodes = useMemo(() => {
    const recursiveMap = (id, parentId, flatItems = {}) => {
      const element = flat[id];
      if (!element) {
        return undefined;
      }

      const {
        definition: { items, label, type }
      } = element;

      const icon = get(componentDefinitions, `${type}.market.icon`);
      if (!items) {
        return { id, label, icon, parentId };
      }

      return {
        id,
        label,
        icon,
        parentId,
        items: items.map(item => recursiveMap(item, id, flatItems)).filter(Boolean)
      };
    };

    const nodesMapped = recursiveMap(baseElementId, undefined, flat);

    if (!baseElementId || !nodesMapped) {
      return [];
    }

    return [nodesMapped];
  }, [flat, baseElement, componentDefinitions]);

  const itemControls = useMemo(() => <BuilderTreeNodeControls />, []);

  return (
    <Tree
      className="w-full"
      size="sm"
      intent="secondary"
      items={nodes}
      itemsOpened={openedCache}
      itemHovered={elementHovered}
      itemSelected={elementSelected}
      itemControls={itemControls}
      onChange={handleChange}
      isDragAllowed={isDragAllowed}
    />
  );
};

export default BuilderTree;
