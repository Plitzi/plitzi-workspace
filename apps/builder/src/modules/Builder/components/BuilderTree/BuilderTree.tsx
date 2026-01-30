import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Tree from '@plitzi/plitzi-ui/Tree';
import get from 'lodash-es/get';
import { useCallback, use, useMemo, useRef } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import BuilderTreeNodeControls from './BuilderTreeNodeControls';
import { recursiveMap } from './utils';

import type { DropPosition, TreeChangeState } from '@plitzi/plitzi-ui/Tree';
import type { Element } from '@plitzi/sdk-shared';

// export type BuilderTreeProps = {};

const BuilderTree = () => {
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
  const [openedCache, setOpenedCache] = useStorage<Record<string, boolean>>(
    'builder-state.builderTree.openedCache',
    {}
  );

  const isDragAllowed = useCallback(
    (id: string, dropPosition: DropPosition, parentId?: string) => {
      const element = get(flatRef.current, id, undefined);
      const parentElement = parentId ? get(flatRef.current, parentId, undefined) : undefined;
      if (!element || (dropPosition !== 'inside' && !parentElement)) {
        return true;
      }

      const {
        definition: { type }
      } = element;

      let { itemsAllowed, itemsNotAllowed } = builderElementPermissions(element);
      if (itemsNotAllowed && dropPosition !== 'inside' && parentElement) {
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
    (state: TreeChangeState) => {
      switch (state.action) {
        case 'itemsOpened': {
          setOpenedCache(state.data);
          break;
        }

        case 'itemChanged': {
          const { item } = state.data;
          const element = get(flatRef.current, item.id) as Element | undefined;
          if (!element) {
            break;
          }

          builderHandler('schemaUpdateElement', {
            ...element,
            definition: { ...element.definition, label: item.label }
          });
          break;
        }

        case 'itemDragged': {
          const { id, toId, dropPosition } = state.data;
          const element = get(flatRef.current, id) as Element | undefined;
          if (!element) {
            break;
          }

          const {
            definition: { type }
          } = element;
          if (id !== toId) {
            void builderDropElement(`move##${type}`, { element, id: element.id }, dropPosition, toId, baseElementId);
          }

          break;
        }
        case 'externalItemDragged': {
          const { toId, dropPosition, event } = state.data;

          try {
            const data = event.dataTransfer.getData(event.dataTransfer.types[0]);
            const dataParsed = JSON.parse(data) as { element: Element; id: Element['id'] };
            if (!(dataParsed as unknown) || !(dataParsed.element as Element | undefined) || !dataParsed.id) {
              console.warn('Invalid data parsed from drag event', dataParsed);
              return;
            }

            const {
              definition: { type }
            } = dataParsed.element;
            void builderDropElement(`add##${type}`, dataParsed, dropPosition, toId, baseElementId);
          } catch {
            // nothing here
          }
          break;
        }

        case 'itemHovered': {
          setHoverElement(state.data);
          break;
        }

        case 'itemSelected': {
          setSelectElement(state.data);
          break;
        }

        case 'isDragging': {
          break;
        }

        default:
      }
    },
    [setOpenedCache, builderHandler, builderDropElement, baseElementId, setHoverElement, setSelectElement]
  );

  const nodes = useMemo(() => {
    const nodesMapped = recursiveMap(flat, componentDefinitions, baseElementId, undefined, flat);
    if (!baseElementId || !nodesMapped) {
      return [];
    }

    return [nodesMapped];
  }, [baseElementId, flat, componentDefinitions]);

  const itemControls = useMemo(() => <BuilderTreeNodeControls />, []);

  return (
    <Tree
      className="w-full py-2"
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
