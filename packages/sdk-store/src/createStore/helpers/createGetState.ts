import { deepMerge } from './deepMerge';

import type { GetState, StoreApi } from '../../types';

// Chain-aware `getState`: deep-merges own state over the parent's, memoized on the own/parent snapshot references
// so it stays referentially stable between changes (required by useSyncExternalStore) and re-merges only when one
// of them changes. `getMergeCount` is a test-only metric.
export function createGetState<TState extends object>(
  getOwnSnapshot: () => TState,
  parent: StoreApi<TState> | undefined
) {
  let mergedCache: TState | undefined;
  let mergedParentRef: TState | undefined;
  let mergedOwnRef: TState | undefined;
  let mergeCount = 0;

  const getState: GetState<TState> = () => {
    const ownState = getOwnSnapshot();
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
