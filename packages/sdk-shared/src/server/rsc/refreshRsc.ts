import { authFailureFromResponse, reportAuthFailure } from '../../auth';
import { getPaths, matchRoutePath } from '../../navigation';
import { hasServerElements } from '../../schema/serverElements';

import type { CommonState, Schema } from '../../types';
import type { PathOf, StoreApi } from '@plitzi/nexus';

/** The page a URL addresses, matched the way the router matches it — so a prefetch asks about the right page. */
const matchRscPageId = (schema: Schema | undefined, location: string, authenticated: boolean): string | undefined => {
  if (!schema) {
    return undefined;
  }

  // The pages, by id — which is what the matcher takes. The flat map's type promises an element for every key, so
  // asking whether one is really there is the only way to skip a page id the schema no longer carries.
  const pages = schema.pages.reduce<Record<string, (typeof schema.flat)[string]>>((acum, pageId) => {
    if (pageId in schema.flat) {
      acum[pageId] = schema.flat[pageId];
    }

    return acum;
  }, {});

  return matchRoutePath(getPaths(pages, schema.pageFolders, authenticated), location.split('?')[0], authenticated)
    .pageId;
};

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
/** Where the visitor is, spelled the way the server reads it back. */
export const currentRscLocation = (): string =>
  typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`;

export const refreshRsc = async (
  store: StoreApi<CommonState>,
  ids?: string[],
  params?: Record<string, string>,
  /**
   * Resolve for somewhere the visitor is not yet.
   *
   * A route change that renders first and fetches after paints a page whose sections have no answer, so the
   * navigation asks for the destination BEFORE it commits. Absent means where the visitor already is, which is
   * every other caller: the initial load, a pager, an element refreshing itself.
   */
  location?: string
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
  const target = location ?? currentRscLocation();
  const schema = store.get('schema');
  // Which page the payload would be for: the one being navigated TO when a destination was named, and the one on
  // screen otherwise. Asking about the current page while prefetching another is how a link into the first
  // server-driven page of a space ends up fetching nothing.
  // Which half of an access-controlled pair a URL resolves to depends on whether there is a session, and that is
  // what the auth source says. Read here rather than passed in: every caller would have to look it up otherwise.
  const auth = store.get('runtime.sources.auth') as { details?: unknown } | undefined;
  const pageId = location
    ? matchRscPageId(schema, location, Boolean(auth?.details))
    : store.get('navigation.currentPageId');
  if (!schema || !hasServerElements(schema, pageId)) {
    return;
  }

  try {
    // The request goes to `/_rsc`, so the server cannot see which page the visitor is on: route params and the
    // page parameter both come from the location travelling with it.
    const search = new URLSearchParams({ location: target });
    if (ids?.length) {
      search.set('ids', ids.join(','));
    }

    Object.entries(params ?? {}).forEach(([key, value]) => search.set(key, value));
    const res = await fetch(`${endpoint}?${search.toString()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      // A refused credential is the earliest evidence a session ended, and this is the request a server-driven page
      // makes most often — so it is usually the first thing to find out. Told here, auth renews or signs the visitor
      // out at once instead of leaving it for the next revalidation timer. Refusals from a backend that is not its
      // own are ignored on the other side.
      const reason = authFailureFromResponse(res.status, await res.json().catch(() => undefined));
      if (reason) {
        reportAuthFailure({ reason, url: endpoint });
      }

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
      // What the payload is FOR. An element on a page this does not name knows its own answer has not arrived
      // yet, instead of reading a missing slice as an answer of "nothing".
      store.set('rsc.location', target);
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
