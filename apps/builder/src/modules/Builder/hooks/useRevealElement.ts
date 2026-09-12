import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { use, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { ElementMatch } from '../helpers/searchElements';

export type RevealTarget = Pick<ElementMatch, 'id' | 'rootId' | 'ancestors'>;

/**
 * Takes the author to an element anywhere in the space: its page or layout on screen, the tree opened down to it,
 * and the element selected.
 *
 * The branches go into the same `openedCache` the tree reads, so revealing a match and expanding a node by hand are
 * the same act — an element eight levels down is selected AND visible in the Layers panel, not selected somewhere
 * the panel is not showing.
 *
 * The switch always goes out, even to the root already on screen: the builder may be showing a layout on top of
 * the current page, and asking for the page is what brings it back. Asking for the root already open is a no-op.
 */
const useRevealElement = () => {
  const [[flat, currentPageId, setSelectElement]] = useBuilderStore([
    'schema.flat',
    'navigation.currentPageId',
    'setSelected'
  ]);
  const [, setOpenedCache] = useStorage<Record<string, boolean>>('builder-state.builderTree.openedCache', {});
  const { eventBridge } = use(EventBridgeContext);
  const navigate = useNavigate();

  return useCallback(
    ({ id, rootId, ancestors }: RevealTarget) => {
      if (ancestors.length > 0) {
        setOpenedCache(state => ({ ...state, ...Object.fromEntries(ancestors.map(ancestor => [ancestor, true])) }));
      }

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
    [currentPageId, eventBridge, flat, navigate, setOpenedCache, setSelectElement]
  );
};

export default useRevealElement;
