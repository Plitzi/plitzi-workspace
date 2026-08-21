import { hasServerElements } from '../../schema/serverElements';

import type { CommonState } from '../../types';
import type { PathOf, StoreApi } from '@plitzi/nexus';

// `PathOf` bottoms out at `rsc.data` — a `Record<string, unknown>` leaf contributes no dynamic key to the union — so
// the element-keyed path is asserted once here instead of at every call site.
export const rscDataPath = (id: string) => `rsc.data.${id}` as PathOf<CommonState>;

/**
 * Re-fetches RSC data into the store.
 *
 * Plain function over a store rather than a context method: the payload lives in `rsc.data`, so every caller already
 * has what it needs through the store it can reach, and an element buried under any number of scopes writes to the
 * root by delegation (nothing but the root owns `rsc`).
 *
 * Pass `ids` to refresh only those elements — the response is merged over the existing payload. Omit them for a full
 * refresh, which replaces it. `params` ride along on the query string; that is how a provider asks for a different
 * page window.
 */
export const refreshRsc = async (
  store: StoreApi<CommonState>,
  ids?: string[],
  params?: Record<string, string>
): Promise<void> => {
  const { enabled, endpoint } = store.get('rsc') ?? {};
  if (!enabled || !endpoint || typeof window === 'undefined') {
    return;
  }

  // Nothing on this page consumes a payload, so the request would be answered and thrown away — and answering it
  // costs the server a resolution pass it only has to make because someone asked. The page id comes from the same
  // route match the server resolves with, so a page the client cannot name is one the server would have resolved
  // nothing for either. Whatever `rsc.data` still holds is left alone: no element here reads it, and the next
  // refresh that does run replaces it wholesale.
  const schema = store.get('schema');
  if (!schema || !hasServerElements(schema, store.get('navigation.currentPageId'))) {
    return;
  }

  try {
    // The request goes to `/_rsc`, so the server cannot see which page the visitor is on: route params and the
    // page parameter both come from the location travelling with it.
    const search = new URLSearchParams({ location: `${window.location.pathname}${window.location.search}` });
    if (ids?.length) {
      search.set('ids', ids.join(','));
    }

    Object.entries(params ?? {}).forEach(([key, value]) => search.set(key, value));
    const res = await fetch(`${endpoint}?${search.toString()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      store.set('rsc.stale', true);

      return;
    }

    const { serverData } = (await res.json()) as { serverData?: Record<string, unknown> };
    store.batch(() => {
      if (ids?.length) {
        Object.entries(serverData ?? {}).forEach(([id, value]) => store.set(rscDataPath(id), value));
      } else {
        store.set('rsc.data', serverData ?? {});
      }

      store.set('rsc.loaded', true);
      store.set('rsc.stale', false);
    });
  } catch {
    /**
     * A refresh that could not reach the server is not an error: the payload is supplemental, and what is on the
     * page keeps working. But keeping the old data with no way to say so is a page that looks current and is not —
     * so the fact is published, and an element with somewhere to show it can.
     */
    store.set('rsc.stale', true);
  }
};

export default refreshRsc;
