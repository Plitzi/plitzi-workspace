import { rscDataPath } from '@plitzi/sdk-shared/server/rsc/refreshRsc';
import useRscRefresh from '@plitzi/sdk-shared/server/rsc/useRscRefresh';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useElement from './useElement';

// Returns the current element's RSC data: its own slice of `rsc.data`, keyed by the ambient element id read from
// `ElementContext`. Lives here (not in sdk-shared, where the rest of the RSC plumbing is) because resolving "the
// current element" needs `useElement`, which is an sdk-elements concern. Subscribing to the element's own path — not
// to the whole payload — is what keeps a refresh of one provider from re-rendering every other server element.
// `elementData` is `null` (not `undefined`) when the element is registered as a server element but carries no extra
// payload; `isServerElement` is the distinction for callers that want to know whether the key was there at all.
const useRscData = <T>() => {
  const { id } = useElement();
  const [[enabled = false, loaded = false, value]] = useCommonStore(['rsc.enabled', 'rsc.loaded', rscDataPath(id)]);
  const refresh = useRscRefresh();

  return {
    enabled,
    /** Whether a payload has arrived at all — the builder and client-only renders never see one. */
    loaded,
    elementData: (value as T | undefined) ?? null,
    isServerElement: value !== undefined,
    refresh
  };
};

export default useRscData;
