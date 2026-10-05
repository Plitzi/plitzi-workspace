import { useEffect, useId } from 'react';

import { useStoreById } from '@plitzi/nexus/react';

import refreshRsc, { currentRscLocation, releaseRscRequests } from './refreshRsc';
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
  const instance = useId();
  const [schemaRsc] = useCommonStore('schema.rsc', { mode: 'mount' });
  // The server resolves the payload from the visitor's location, so the location is what a refresh keys off — not the
  // page id: `/posts/1` → `/posts/2` is the same page with a different record, and a `?page=` change is a new window.
  // Where the visitor is and nothing else: a navigation still on its way is not a new location.
  const [navigation] = useCommonStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.currentPageId',
    'navigation.href'
  ]);
  const locationKey = JSON.stringify(navigation);
  const { rscData, rscPath: endpoint } = ssr ?? {};
  const enabled = (schemaRsc?.enabled ?? false) && !!endpoint;

  useCommonStoreSync(['rsc.enabled', 'rsc.endpoint', 'rsc.instance'], [enabled, endpoint, instance]);
  // Mount-only: what the server handed over is the starting payload, and every later write belongs to `refreshRsc`.
  // Re-syncing it would replay the initial payload over refreshed data.
  useCommonStoreSync(
    ['rsc.data', 'rsc.loaded', 'rsc.location'],
    [rscData?.serverData ?? {}, rscData !== undefined, currentRscLocation()],
    { mode: 'mount' }
  );

  useEffect(() => () => releaseRscRequests(instance), [instance]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    /**
     * Already answered for where the visitor is: the payload the server rendered the page with, or the one a
     * navigation asked for before it went. Asked again here, every click on a link cost the server two renders — the
     * prefetch, then this. The payload MOVES with every refresh, so coming back to where the session started is a
     * location the store no longer holds, and is asked for.
     */
    const answered =
      store.get('rsc.loaded') && store.get('rsc.location') === currentRscLocation() && !store.get('rsc.stale');
    if (answered) {
      return;
    }

    void refreshRsc(store);
  }, [enabled, locationKey, store]);
};

export default useRscSync;
