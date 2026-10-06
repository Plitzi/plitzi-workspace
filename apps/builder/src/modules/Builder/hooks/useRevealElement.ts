import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { use, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore, useBuilderStoreSetter } from '@plitzi/sdk-shared/store';

import { chainOf } from '../helpers/elementChain';

import type { ElementMatch } from '../helpers/searchElements';

export type RevealTarget = Pick<ElementMatch, 'id' | 'rootId' | 'ancestors'>;

/**
 * Takes the author to an element anywhere in the space: its page, layout or component on screen, the tree opened down
 * to it, and the element selected.
 *
 * The branches go into the same `openedCache` the tree reads, so revealing a match and expanding a node by hand are
 * the same act — an element eight levels down is selected AND visible in the Layers panel, not selected somewhere
 * the panel is not showing.
 *
 * An element a component holds is reached by opening that component, whatever the caller worked out as its root: the
 * pages' `flat` does not hold it unless the component is already open. One on a page closes the component open, if
 * any, since the canvas shows the component in its place while it is.
 *
 * The switch always goes out, even to the root already on screen: the builder may be showing a layout on top of
 * the current page, and asking for the page is what brings it back. Asking for the root already open is a no-op.
 */
const useRevealElement = () => {
  const [[flat, components, componentOpen, currentPageId, setSelectElement]] = useBuilderStore([
    'schema.flat',
    'schema.components',
    'componentOpen',
    'navigation.currentPageId',
    'setSelected'
  ]);
  const setBuilderStore = useBuilderStoreSetter();
  const [, setOpenedCache] = useStorage<Record<string, boolean>>('builder-state.builderTree.openedCache', {});
  const { eventBridge } = use(EventBridgeContext);
  const navigate = useNavigate();

  const openBranches = useCallback(
    (ancestors: string[]) => {
      if (ancestors.length > 0) {
        setOpenedCache(state => ({ ...state, ...Object.fromEntries(ancestors.map(ancestor => [ancestor, true])) }));
      }
    },
    [setOpenedCache]
  );

  return useCallback(
    ({ id, rootId, ancestors }: RevealTarget) => {
      const owner = Object.values(components).find(component => Object.hasOwn(component.flat, id));
      if (owner) {
        openBranches(chainOf(owner.flat, id).ancestors);
        if (owner.id === componentOpen) {
          setSelectElement(id);

          return;
        }

        setBuilderStore('componentOpen', owner.id);
        // Forced: the selection is checked against the tree on screen, and the component's is not drawn until the
        // builder opens it after this call. The element is in it, which is what that check is there to make sure of.
        setSelectElement(id, undefined, true);

        return;
      }

      if (componentOpen) {
        setBuilderStore('componentOpen', undefined);
      }

      openBranches(ancestors);

      // A page is a route in this editor and a layout is not, so opening one is not the same act as opening the
      // other — the directory makes the same split, for the same reason.
      const rootType = get(flat, `${rootId}.definition.type`, '');
      if (rootType !== 'layoutContainer' && rootId !== currentPageId) {
        void navigate(`/${rootId}`);
      } else {
        void eventBridge.emit('builder', 'builderSetBaseContext', rootId);
      }

      // Opening a root keeps a selection that lives inside it, so selecting in the same tick as the switch sticks.
      setSelectElement(id);
    },
    [
      components,
      componentOpen,
      currentPageId,
      eventBridge,
      flat,
      navigate,
      openBranches,
      setBuilderStore,
      setSelectElement
    ]
  );
};

export default useRevealElement;
