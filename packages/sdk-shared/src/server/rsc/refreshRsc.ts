import { authFailureFromResponse, reportAuthFailure } from '../../auth';
import { getPaths, matchRoutePath } from '../../navigation';
import { collectServerElements, hasServerElements } from '../../schema/serverElements';
// The recorder itself rather than the barrel, which also exports a React hook this module has no business loading.
import { recordRenderActionRuns } from '../../store/actionRuns/actionRunsRecorder';

import type { ActionRunSummary, CommonState, Schema } from '../../types';
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

/**
 * Of `ids`, the ones the server resolves on `pageId` — the same walk it makes — in the order they were named.
 *
 * An element of the page a navigation is leaving is still drawn for a render or two after the route moved, and
 * whatever it asks for then — a bound `input` re-resolving against the new route, an invalidation, a timer — is asked
 * about the NEW address: a story's provider asking `/writers` for itself, to be answered with nothing.
 */
const servedIds = (
  schema: Schema,
  pageId: string | undefined,
  ids: readonly string[],
  flags: Record<string, boolean> | undefined
): string[] => {
  const served = new Set(collectServerElements(schema, pageId, [...ids], flags).map(({ id }) => id));

  return ids.filter(id => served.has(id));
};

// `PathOf` bottoms out at `rsc.data` — a `Record<string, unknown>` leaf contributes no dynamic key to the union — so
// the element-keyed path is asserted once here instead of at every call site.
export const rscDataPath = (id: string) => `rsc.data.${id}` as PathOf<CommonState>;

/** Where the visitor is, spelled the way the server reads it back. */
export const currentRscLocation = (): string =>
  typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`;

/** The key a whole-payload request is asked for under, among the element ids a partial one names. */
const WHOLE = '*';

/** One request to the endpoint, while it is in flight. */
type RscRequest = {
  /** The request's URL: two asks for the same URL are one request. */
  url: string;
  /** The elements it asks for; absent for the whole payload. */
  ids?: readonly string[];
  /** Whether it asks about where the visitor is now — a navigation's prefetch asks about somewhere else. */
  here: boolean;
  /** Whether it went around every cache on its way — see {@link RscRefreshOptions.fresh}. */
  fresh: boolean;
  seq: number;
  controller: AbortController;
  promise: Promise<void>;
};

/** What one SDK root has asked its endpoint for, and in which order. */
type RscRequests = {
  seq: number;
  inFlight: Set<RscRequest>;
  /** The last request that asked for each element (or for the whole payload): only its answer is written. */
  asked: Map<string, number>;
};

/**
 * The requests of each SDK root, by the token `useRscSync` seeds in `rsc.instance`.
 *
 * Keyed by that token rather than by the store: an element writes through a scoped store of its own, which delegates
 * `rsc` to the root, so two elements of one page hold different store objects and must still see each other's
 * requests. A store with no token — one built by hand, a test — is its own root.
 */
const requestsByInstance = new Map<string, RscRequests>();
const requestsByStore = new WeakMap<StoreApi<CommonState>, RscRequests>();

const newRequests = (): RscRequests => ({ seq: 0, inFlight: new Set(), asked: new Map() });

const requestsOf = (store: StoreApi<CommonState>): RscRequests => {
  const instance = store.get('rsc.instance');
  if (typeof instance === 'string' && instance) {
    const known = requestsByInstance.get(instance);
    if (known) {
      return known;
    }

    const created = newRequests();
    requestsByInstance.set(instance, created);

    return created;
  }

  const known = requestsByStore.get(store);
  if (known) {
    return known;
  }

  const created = newRequests();
  requestsByStore.set(store, created);

  return created;
};

/** The elements a refresh in flight is refreshing right now, for the page on screen — published as `rsc.refreshing`. */
const publishRefreshing = (store: StoreApi<CommonState>, requests: RscRequests) => {
  const refreshing: Record<string, boolean> = {};
  requests.inFlight.forEach(request => {
    if (!request.here) {
      return;
    }

    (request.ids ?? [WHOLE]).forEach(id => {
      refreshing[id] = true;
    });
  });

  store.set('rsc.refreshing', refreshing);
};

/** Whether `older` asks for nothing `newer` does not ask for again — so its answer can only ever be overwritten. */
const covers = (newer: readonly string[] | undefined, older: readonly string[] | undefined): boolean =>
  !newer || (!!older && older.every(id => newer.includes(id)));

/**
 * Stops what a refresh in flight is asking the server for — the request, and the work behind it on the server — and
 * leaves the payload as it is.
 *
 * `ids` cancels the refreshes of those elements; nothing cancels every refresh in flight, a navigation's included.
 * What a STOP button is: the visitor is done waiting, and what is on screen stays.
 */
export const cancelRsc = (store: StoreApi<CommonState>, ids?: readonly string[]): void => {
  const requests = requestsOf(store);
  requests.inFlight.forEach(request => {
    if (!ids || request.ids?.some(id => ids.includes(id))) {
      request.controller.abort();
    }
  });
};

/** Every refresh of this root aborted and forgotten — the SDK root that owned them is going away. */
export const releaseRscRequests = (instance: string): void => {
  requestsByInstance.get(instance)?.inFlight.forEach(request => request.controller.abort());
  requestsByInstance.delete(instance);
};

/**
 * The answer written, unless a later request asked for the same thing.
 *
 * Answers do not arrive in the order they were asked for: a window asked for second can be answered first. Written as
 * they land, the last to ARRIVE won — a page showing 48 hours under an address that says 6. So each element takes
 * only the answer of the last request that asked for it; a whole-payload answer keeps, for an element asked for
 * again after it, what that element has.
 */
const writeAnswer = (
  store: StoreApi<CommonState>,
  requests: RscRequests,
  request: RscRequest,
  serverData: Record<string, unknown>,
  target: string
) => {
  const { ids, seq } = request;
  store.batch(() => {
    if (ids?.length) {
      Object.entries(serverData).forEach(([id, value]) => {
        if ((requests.asked.get(id) ?? 0) <= seq && (requests.asked.get(WHOLE) ?? 0) <= seq) {
          store.set(rscDataPath(id), value);
        }
      });
    } else {
      const current = store.get('rsc.data') ?? {};
      const askedSince = (id: string) => id !== WHOLE && (requests.asked.get(id) ?? 0) > seq;
      const next = Object.fromEntries([
        ...Object.entries(serverData).filter(([id]) => !askedSince(id)),
        ...Object.entries(current).filter(([id]) => askedSince(id))
      ]);
      store.set('rsc.data', next);
    }

    store.set('rsc.loaded', true);
    store.set('rsc.stale', false);
    // What the payload is FOR. An element on a page this does not name knows its own answer has not arrived
    // yet, instead of reading a missing slice as an answer of "nothing".
    store.set('rsc.location', target);
  });
};

export type RscRefreshOptions = {
  /**
   * Resolve for somewhere the visitor is not yet.
   *
   * A route change that renders first and fetches after paints a page whose sections have no answer, so the
   * navigation asks for the destination BEFORE it commits. Absent means where the visitor already is, which is
   * every other caller: the initial load, a pager, an element refreshing itself.
   */
  location?: string;
  /**
   * Ask the server itself, around the browser's cache and the page server's.
   *
   * Outside `main` an answer is kept for a while on both — the same question from many visitors is resolved once —
   * which is right for a page window and wrong for a refresh that exists because something changed: a write, an
   * explicit reload. Asked through either cache, that refresh is answered with the slice from before the write. A
   * header rather than a query parameter, because every parameter of the request is input to what it resolves.
   */
  fresh?: boolean;
};

/**
 * Re-fetches RSC data into the store.
 *
 * Plain function over a store rather than a context method: the payload lives in `rsc.data`, so every caller already
 * has what it needs through the store it can reach, and an element buried under any number of scopes writes to the
 * root by delegation (nothing but the root owns `rsc`).
 *
 * Pass `requestedIds` to refresh only those elements — the response is merged over the existing payload; of them,
 * only the ones the server resolves at that location are asked for, and none is no request. Omit them for a full
 * refresh, which replaces it. `params` ride along on the query string; that is how a provider asks for a different
 * page window.
 *
 * One request per question, and the newest question wins: asking again for what is already in flight is answered by
 * the request in flight, and a request whose answer a newer one would overwrite anyway — a whole payload asked for
 * again, an element asked for again — is aborted, here and on the server. Before this a click on a link asked twice
 * (its prefetch, then the route change), and a slow answer could land over a newer one.
 */
export const refreshRsc = async (
  store: StoreApi<CommonState>,
  requestedIds?: string[],
  params?: Record<string, string>,
  { location, fresh = false }: RscRefreshOptions = {}
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
  // The flags as they resolved for the page on screen, so a server element gated off asks for nothing. Not for a page
  // being navigated to: a flag's rule may read the route, and the server — which decides anyway — resolves them there.
  const flags = location ? undefined : store.get('runtime.sources.flags');
  if (!schema) {
    return;
  }

  const ids = requestedIds?.length ? servedIds(schema, pageId, requestedIds, flags) : undefined;
  if (ids ? !ids.length : !hasServerElements(schema, pageId, flags)) {
    return;
  }

  // The request goes to `/_rsc`, so the server cannot see which page the visitor is on: route params and the
  // page parameter both come from the location travelling with it.
  const search = new URLSearchParams({ location: target });
  if (ids?.length) {
    search.set('ids', ids.join(','));
  }

  Object.entries(params ?? {}).forEach(([key, value]) => search.set(key, value));
  const url = `${endpoint}?${search.toString()}`;

  const requests = requestsOf(store);
  // A request already out answers this one unless this one must go around the caches and that one did not.
  const asking = [...requests.inFlight].find(request => request.url === url && (request.fresh || !fresh));
  if (asking) {
    return asking.promise;
  }

  requests.inFlight.forEach(request => {
    if (covers(ids, request.ids)) {
      request.controller.abort();
    }
  });

  const seq = ++requests.seq;
  if (ids?.length) {
    ids.forEach(id => requests.asked.set(id, seq));
  } else {
    requests.asked.clear();
    requests.asked.set(WHOLE, seq);
  }

  const controller = new AbortController();
  const request: RscRequest = {
    url,
    ...(ids?.length ? { ids } : {}),
    here: target === currentRscLocation(),
    fresh,
    seq,
    controller,
    promise: Promise.resolve()
  };

  /** One ask — and, after a refusal that renewed the session, the one second ask. */
  const ask = async (retried: boolean): Promise<void> => {
    // `cache` keeps the browser from answering it; the header is what tells the page server.
    const init: RequestInit = fresh
      ? { cache: 'no-cache', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } }
      : { headers: { Accept: 'application/json' } };
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      // A refused credential is the earliest evidence a session ended, and this is the request a server-driven page
      // makes most often — so it is usually the first thing to find out. Told here, auth renews or signs the visitor
      // out at once instead of leaving it for the next revalidation timer. Refusals from a backend that is not its
      // own are ignored on the other side.
      // Renewed because of it, the refresh is asked again, once: a section refreshed as the tab came back is not left
      // stale over a credential that had only expired.
      const reason = authFailureFromResponse(res.status, await res.json().catch(() => undefined));
      if (reason && (await reportAuthFailure({ reason, url: endpoint })) && !retried) {
        return ask(true);
      }

      store.set('rsc.stale', true);

      return;
    }

    const { serverData, actionRuns } = (await res.json()) as {
      serverData?: Record<string, unknown>;
      actionRuns?: ActionRunSummary[];
    };

    // What the server ran to answer this, for a page allowed to debug it — it only ever sends them to one. Recorded
    // before the payload lands, so the dev-tools show the run beside the section it just changed.
    if (actionRuns?.length) {
      recordRenderActionRuns(actionRuns);
    }

    writeAnswer(store, requests, request, serverData ?? {}, target);
  };

  request.promise = ask(false)
    .catch(() => {
      // Cancelled, or asked again since: the newer question is the one with something to say.
      if (controller.signal.aborted) {
        return;
      }

      /**
       * A refresh that could not reach the server is not an error: the payload is supplemental, and what is on the
       * page keeps working. But keeping the old data with no way to say so is a page that looks current and is not —
       * so the fact is published, and an element with somewhere to show it can.
       */
      store.set('rsc.stale', true);
    })
    .finally(() => {
      requests.inFlight.delete(request);
      publishRefreshing(store, requests);
    });
  requests.inFlight.add(request);
  publishRefreshing(store, requests);

  return request.promise;
};

export default refreshRsc;
