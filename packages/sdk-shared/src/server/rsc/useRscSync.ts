import { useEffect, useRef } from 'react';

import { useStoreById } from '@plitzi/nexus/react';

import refreshRsc from './refreshRsc';
import { useCommonStore, useCommonStoreSync } from '../../store';

import type { CommonState, ServerSSR } from '../../types';

/**
 * Seeds `rsc` at the SDK root and keeps it fresh. Called once, where the server info is in hand; everything below
 * reads the store instead of taking the payload as a prop.
 *
 * A schema can ask for RSC, but only a server can answer it: `rscPath` is published solely by a server that mounts
 * the endpoint, so a client-only render (an embed, the builder, an offline widget) leaves the feature inert instead
 * of fetching a guaranteed 404 against whatever origin the page lives on.
 */
const useRscSync = (ssr?: ServerSSR) => {
  const store = useStoreById<CommonState>();
  const [schemaRsc] = useCommonStore('schema.rsc', { mode: 'mount' });
  // The server resolves the payload from the visitor's location, so the location is what a refresh keys off — not the
  // page id: `/posts/1` → `/posts/2` is the same page with a different record, and a `?page=` change is a new window.
  const [navigation] = useCommonStore('runtime.sources.navigation');
  const { rscData, rscPath: endpoint } = ssr ?? {};
  const enabled = (schemaRsc?.enabled ?? false) && !!endpoint;

  useCommonStoreSync(['rsc.enabled', 'rsc.endpoint'], [enabled, endpoint]);
  // Mount-only: what the server handed over is the starting payload, and every later write belongs to `refreshRsc`.
  // Re-syncing it would replay the initial payload over refreshed data.
  useCommonStoreSync(['rsc.data', 'rsc.loaded'], [rscData?.serverData ?? {}, rscData !== undefined], {
    mode: 'mount'
  });

  const navigationKey = JSON.stringify(navigation ?? {});
  // The location the server rendered: its payload is already in the store, so that first view costs no request.
  const renderedKey = useRef(rscData === undefined ? undefined : navigationKey).current;

  useEffect(() => {
    if (!enabled || navigationKey === renderedKey) {
      return;
    }

    void refreshRsc(store);
  }, [enabled, navigationKey, renderedKey, store]);
};

export default useRscSync;
