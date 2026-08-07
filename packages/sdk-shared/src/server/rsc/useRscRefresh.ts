import { useCallback } from 'react';

import { useStoreById } from '@plitzi/nexus/react';

import refreshRsc from './refreshRsc';

import type { CommonState } from '../../types';

// The imperative half of RSC, bound to the store the caller sits in. A write to `rsc.*` is delegated up to the root
// that owns it, so an element nested under any number of scopes refreshes the same payload the whole tree reads.
const useRscRefresh = () => {
  const store = useStoreById<CommonState>();

  return useCallback((ids?: string[], params?: Record<string, string>) => refreshRsc(store, ids, params), [store]);
};

export default useRscRefresh;
