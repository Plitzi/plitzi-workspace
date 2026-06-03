import { deepMerge } from './deepMerge';

import type { GetState, StoreApi } from '../../types';

// Builds the chain-aware `getState`: deep-merges own state over the parent's, memoized so snapshots stay
// referentially stable between changes (required by useSyncExternalStore). Re-merges only when own OR parent
// state changes. `getMergeCount` exposes how many merges actually ran (test-only metric).
export function createGetState<TState extends object>(getOwnState: () => TState, parent: StoreApi<TState> | undefined) {
  let mergedCache: TState | undefined;
  let mergedParentRef: TState | undefined;
  let mergedOwnRef: TState | undefined;
  let mergeCount = 0;

  const getState: GetState<TState> = () => {
    const ownState = getOwnState();
    if (!parent) {
      return ownState;
    }

    const parentState = parent.getState();
    if (mergedCache !== undefined && parentState === mergedParentRef && ownState === mergedOwnRef) {
      return mergedCache;
    }

    mergedParentRef = parentState;
    mergedOwnRef = ownState;
    mergedCache = deepMerge(parentState, ownState) as TState;
    mergeCount++;

    return mergedCache;
  };

  return { getState, getMergeCount: () => mergeCount };
}
