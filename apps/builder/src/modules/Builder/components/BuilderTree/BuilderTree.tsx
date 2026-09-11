import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import Tree from '@plitzi/plitzi-ui/Tree';
import clsx from 'clsx';
import { useCallback, use, useMemo, useState } from 'react';

import { elementIdConflict, slugifyElementId } from '@plitzi/sdk-schema/helpers/elementId';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStore, useBuilderStoreGetter } from '@plitzi/sdk-shared/store';
import { processPaste } from '@pmodules/Builder/BuilderHelper';

import BuilderTreeNodeControls from './BuilderTreeNodeControls';
import BuilderTreeSearch from './BuilderTreeSearch';
import { recursiveMap } from './utils';

import type { DropPosition, TreeChangeState } from '@plitzi/plitzi-ui/Tree';
import type { Element } from '@plitzi/sdk-shared';
import type { ClipboardEvent } from 'react';

const BuilderTree = () => {
  const [getSchema, getElement, getStyle] = useBuilderStoreGetter(['schema', 'schema.flat', 'style']);
  const [[flat, elementHovered, setHoverElement, elementSelected, setSelectElement]] = useBuilderStore([
    'schema.flat',
    'elementHovered',
    'setHovered',
    'elementSelected',
    'setSelected'
  ]);
  const { componentDefinitions } = use(ComponentContext);
  const { addToast } = useToast();
  const { mutate } = use(NetworkContext);
  const {
    baseContext: { baseElementId },
    builderHandler,
    builderElementPermissions,
    builderDropElement
  } = use(BuilderContext);
  const [openedCache, setOpenedCache] = useStorage<Record<string, boolean>>(
    'builder-state.builderTree.openedCache',
    {}
  );
  const [query, setQuery] = useState('');

  /**
   * Opens the branches a match is buried under, and closes the search on the way.
   *
   * The same `openedCache` the tree already reads, so revealing a result and expanding a node by hand are the same
   * act — an element eight levels down is selected AND visible, rather than selected somewhere the panel is not
   * showing. Clearing the query is what puts the tree back on screen to show it.
   */
  const handleReveal = useCallback(
    (ancestors: string[]) => {
      if (ancestors.length > 0) {
        setOpenedCache(state => ({ ...state, ...Object.fromEntries(ancestors.map(id => [id, true])) }));
      }

      setQuery('');
    },
    [setOpenedCache]
  );

  const isDragAllowed = useCallback(
    (id: string, dropPosition: DropPosition, parentId?: string) => {
      const element = getElement(id, undefined);
      const parentElement = parentId ? getElement(parentId) : undefined;
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
    [builderElementPermissions, getElement]
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
          const element = getElement(item.id, undefined);
          if (!element) {
            break;
          }

          // Renaming in the tree renames the element: the label shown here is its id.
          const id = slugifyElementId(item.label);
          if (!id || id === element.id || elementIdConflict(getElement(), id, element.id)) {
            break;
          }

          builderHandler('schemaRenameElement', element.id, id);
          break;
        }

        case 'itemDragged': {
          const { id, toId, dropPosition } = state.data;
          const element = getElement(id, undefined);
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
            const dataParsed = JSON.parse(data) as { element: Element; id?: string };
            if (!(dataParsed as unknown) || !(dataParsed.element as Element | undefined)) {
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
    [setOpenedCache, getElement, builderHandler, builderDropElement, baseElementId, setHoverElement, setSelectElement]
  );

  const nodes = useMemo(() => {
    const nodesMapped = recursiveMap(flat, componentDefinitions.current, baseElementId);
    if (!baseElementId || !nodesMapped) {
      return [];
    }

    return [nodesMapped];
  }, [flat, componentDefinitions, baseElementId]);

  const handleCopy = useCallback(
    (e: ClipboardEvent) => {
      if (!elementSelected) {
        return;
      }

      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(getSchema(), getStyle(), elementSelected);
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
    [addToast, elementSelected, getSchema, getStyle]
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

  const searching = query.trim() !== '';

  return (
    <div className="flex min-h-0 w-full grow basis-0 flex-col">
      <BuilderTreeSearch query={query} baseElementId={baseElementId} onQueryChange={setQuery} onReveal={handleReveal} />
      {/* Hidden rather than unmounted: the tree keeps its scroll position and its open branches, so clearing the
          search puts the author back exactly where they were instead of at the top of a collapsed tree. */}
      <div className={clsx('min-h-0 grow basis-0 overflow-y-auto', { hidden: searching })}>
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
      </div>
    </div>
  );
};

export default BuilderTree;
