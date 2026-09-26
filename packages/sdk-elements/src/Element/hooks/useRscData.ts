import { useRef } from 'react';

import { currentRscLocation, rscDataPath } from '@plitzi/sdk-shared/server/rsc/refreshRsc';
import useRscRefresh from '@plitzi/sdk-shared/server/rsc/useRscRefresh';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useElement from './useElement';

// Returns the current element's RSC data: its own slice of `rsc.data`, keyed by the ambient element id read from
// `ElementContext`. Lives here (not in sdk-shared, where the rest of the RSC plumbing is) because resolving "the
// current element" needs `useElement`, which is an sdk-elements concern. Subscribing to the element's own path — not
// to the whole payload — is what keeps a refresh of one provider from re-rendering every other server element.
// `elementData` is `null` (not `undefined`) when the element is registered as a server element but carries no extra
// payload; `isServerElement` is the distinction for callers that want to know whether the key was there at all.
// `pending` is the third case and the one a route change creates: the payload in the store is for another page.
const useRscData = <T>() => {
  const { id, rootId } = useElement();
  const [[enabled = false, loaded = false, stale = false, location, value, currentPageId, pages]] = useCommonStore([
    'rsc.enabled',
    'rsc.loaded',
    'rsc.stale',
    'rsc.location',
    rscDataPath(id),
    'navigation.currentPageId',
    'schema.pages'
  ]);
  const refresh = useRscRefresh();

  /**
   * Whether the payload in the store is somebody else's: resolved for another address, or this element is on a page
   * that is no longer the one on screen.
   *
   * A navigation asks for its destination's payload BEFORE it leaves, so the page it leaves is still drawn — first
   * while the answer lands, then for the moment the next page takes to render — over a payload with no slice for
   * anything on it. Read as an answer, every section of the page on its way out drew itself empty: a list of boards
   * turned into "nothing here yet" on the click that opened one of them. A layout's element is on every page, and is
   * never on its way out.
   */
  const elsewhere =
    (location !== undefined && location !== currentRscLocation()) ||
    (rootId !== undefined && rootId !== currentPageId && pages.includes(rootId));
  /** The last answer this element had for where it is — what it keeps showing while the payload is somebody else's. */
  const kept = useRef<unknown>(undefined);
  if (!elsewhere && value !== undefined) {
    kept.current = value;
  }

  const answer = elsewhere && kept.current !== undefined ? kept.current : value;

  return {
    enabled,
    /** Whether a payload has arrived at all — the builder and client-only renders never see one. */
    loaded,
    /** True when the last refresh could not reach the server: what is on screen is from before that. */
    stale,
    /**
     * The location the payload in the store was resolved for.
     *
     * A caller compares it with where the visitor is now: a route change renders the new page long before its
     * data can arrive, and an element that cannot tell "nobody has asked for me yet" from "there is nothing here"
     * paints the second one. Compared by whoever already re-renders on navigation, which this hook does not.
     */
    location,
    elementData: (answer as T | undefined) ?? null,
    isServerElement: answer !== undefined,
    refresh
  };
};

export default useRscData;
