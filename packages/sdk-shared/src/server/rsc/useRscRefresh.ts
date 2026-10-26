import { useCallback } from 'react';

import { useStoreById } from '@plitzi/nexus/react';

import refreshRsc from './refreshRsc';

import type { RscRefreshOptions } from './refreshRsc';
import type { CommonState } from '../../types';

// The imperative half of RSC, bound to the store the caller sits in. The refresh writes `rsc.*` at the SDK root that
// owns it (`holdRscRoot`), so an element nested under any number of scopes refreshes the payload the whole tree reads.
const useRscRefresh = () => {
  const store = useStoreById<CommonState>();

  return useCallback(
    (ids?: string[], params?: Record<string, string>, { fresh }: Pick<RscRefreshOptions, 'fresh'> = {}) =>
      refreshRsc(store, ids, params, { fresh }),
    [store]
  );
};

export default useRscRefresh;
