import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Tree from '@plitzi/plitzi-ui/Tree';
import get from 'lodash/get';
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

export type BuilderTreeProps = {
  setDragTree?: (dragTree: boolean) => void;
};

const BuilderTree = ({ setDragTree }: BuilderTreeProps) => {
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
          const { id, toId, dropPosition, event } = state.data;
          const element = get(flatRef.current, id) as Element | undefined;
          if (!element) {
            break;
          }

          const {
            definition: { type }
          } = element;
          if ((id && id === toId) || !id) {
            try {
              let data: unknown = event.dataTransfer.getData(event.dataTransfer.types[0]);
              data = JSON.parse(data as string);
              void builderDropElement(`add##${type}`, data, dropPosition, toId, baseElementId);
            } catch {
              // nothing here
            }
          } else {
            void builderDropElement(`move##${type}`, { element, id: element.id }, dropPosition, toId, baseElementId);
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
          setDragTree?.(state.data);
          break;
        }

        default:
      }
    },
    [setOpenedCache, builderHandler, builderDropElement, baseElementId, setHoverElement, setSelectElement, setDragTree]
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
