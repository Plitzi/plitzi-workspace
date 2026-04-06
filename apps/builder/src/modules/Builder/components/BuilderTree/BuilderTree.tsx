import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import Tree from '@plitzi/plitzi-ui/Tree';
import { useCallback, use, useMemo } from 'react';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import { processPaste } from '@pmodules/Builder/BuilderHelper';

import BuilderTreeNodeControls from './BuilderTreeNodeControls';
import { recursiveMap } from './utils';

import type { DropPosition, TreeChangeState } from '@plitzi/plitzi-ui/Tree';
import type { BuilderState, Element } from '@plitzi/sdk-shared';
import type { ClipboardEvent } from 'react';

const BuilderTree = () => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[schema, style]] = useStore(['schema', 'style']);
  const { componentDefinitions } = use(ComponentContext);
  const { elementHovered, setHovered: setHoverElement } = use(BuilderHoveredContext);
  const { elementSelected, setSelected: setSelectElement } = use(BuilderSelectedContext);
  const { builderDropElement } = use(BuilderSchemaContext);
  const { addToast } = useToast();
  const { mutate } = use(NetworkContext);
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
      const element = get(schema.flat, id, undefined);
      const parentElement = parentId ? get(schema.flat, parentId, undefined) : undefined;
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
    [builderElementPermissions, schema.flat]
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
          const element = get(schema.flat, item.id) as Element | undefined;
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
          const element = get(schema.flat, id) as Element | undefined;
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
    [setOpenedCache, schema.flat, builderHandler, builderDropElement, baseElementId, setHoverElement, setSelectElement]
  );

  const nodes = useMemo(() => {
    const nodesMapped = recursiveMap(schema.flat, componentDefinitions.current, baseElementId, undefined, schema.flat);
    if (!baseElementId || !nodesMapped) {
      return [];
    }

    return [nodesMapped];
  }, [baseElementId, schema.flat, componentDefinitions]);

  const handleCopy = useCallback(
    (e: ClipboardEvent) => {
      if (!elementSelected) {
        return;
      }

      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(schema, style, elementSelected);
      e.clipboardData.setData(
        'application/json',
        JSON.stringify({
          type: 'add##plitzi-template',
          payload: { elements, style: elementsStyle, assets: [], variables }
        })
      );

      addToast('Element copied into the clipboard', { appeareance: 'info', autoDismiss: true, placement: 'top-right' });
      e.preventDefault();
    },
    [addToast, elementSelected, schema, style]
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!elementSelected) {
        return;
      }

      const result = await processPaste(e.clipboardData, {
        mutate,
        builderDropElement,
        elementSelected,
        componentDefinitions: componentDefinitions.current,
        baseElementId,
        builderHandler
      });

      if (!result) {
        addToast('Cant drop it here. Try another spot!', {
          appeareance: 'error',
          autoDismiss: true,
          placement: 'top-right'
        });
      }
    },
    [addToast, baseElementId, builderDropElement, builderHandler, componentDefinitions, elementSelected, mutate]
  );

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
      onCopy={handleCopy}
      onPaste={handlePaste}
    />
  );
};

export default BuilderTree;
