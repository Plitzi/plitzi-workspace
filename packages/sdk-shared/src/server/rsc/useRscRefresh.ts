import { useCallback } from 'react';

import { useStoreById } from '@plitzi/nexus/react';

import refreshRsc from './refreshRsc';

import type { RscRefreshOptions } from './refreshRsc';
import type { CommonState } from '../../types';

// The imperative half of RSC, bound to the store the caller sits in. A write to `rsc.*` is delegated up to the root
// that owns it, so an element nested under any number of scopes refreshes the same payload the whole tree reads.
const useRscRefresh = () => {
  const store = useStoreById<CommonState>();

  return useCallback(
    (ids?: string[], params?: Record<string, string>, { fresh }: Pick<RscRefreshOptions, 'fresh'> = {}) =>
      refreshRsc(store, ids, params, { fresh }),
    [store]
  );
};

export default useRscRefresh;
