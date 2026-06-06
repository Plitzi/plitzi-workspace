/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { deepMerge, isPlainObject } from './deepMerge';
import getByPath from '../../helpers/getByPath';

import type { GetState, PathOf, PathValue, StoreApi } from '../../types';

export type GetPath<TState extends object> = <P extends PathOf<TState>>(path: P) => PathValue<TState, P> | undefined;

// The two chain-aware reads of a scoped store, behind one cache:
//   - `getState` deep-merges own state over the parent's merged state (the full scoped view).
//   - `getPath` resolves a single path without materializing that merge — straight to the owner.
// Both are O(depth) the first time (they walk the parent chain) and both are memoized so repeats are O(1). They
// share one invalidation substrate: the store calls `invalidate()` from the change events it already emits (own
// commit, forwarded ancestor change, silent ancestor change), and both caches drop together. `setActive(false)`
// turns caching off for a detached scope — one that receives no invalidations — so it always resolves fresh.
export type ChainReads<TState extends object> = {
  getState: GetState<TState>;
  getPath: GetPath<TState>;
  invalidate: () => void;
  setActive: (active: boolean) => void;
  getMergeCount: () => number;
};

export function createChainReads<TState extends object>(
  getOwnState: () => TState,
  getOwnSnapshot: () => TState,
  parent: StoreApi<TState> | undefined
): ChainReads<TState> {
  if (!parent) {
    // A root store is its own state — no merge, no fall-through, nothing to invalidate.
    return {
      getState: getOwnSnapshot,
      getPath: path => getByPath(getOwnState(), path),
      invalidate: () => {},
      setActive: () => {},
      getMergeCount: () => 0
    };
  }

  const parentStore = parent;

  let active = true;
  let stateDirty = true;
  let pathDirty = false;
  let merged: TState | undefined;
  let mergeCount = 0;
  const pathCache = new Map<string, unknown>();

  const mergeNow = (): TState => {
    mergeCount++;

    return deepMerge(parentStore.getState(), getOwnSnapshot()) as TState;
  };

  const getState: GetState<TState> = () => {
    // Detached: no invalidations arrive, so the cache can't be trusted — merge fresh every time. (A detached scope
    // has no reactive consumer; any caller's own equality check absorbs the new reference.)
    if (!active) {
      return mergeNow();
    }

    if (stateDirty || merged === undefined) {
      merged = mergeNow();
      stateDirty = false;
    }

    return merged;
  };

  const resolve = <P extends PathOf<TState>>(path: P): PathValue<TState, P> | undefined => {
    const ownValue = getByPath(getOwnState(), path);
    if (ownValue === undefined) {
      return parentStore.getPath(path);
    }

    const parentValue = parentStore.getPath(path);
    if (parentValue === undefined || !isPlainObject(ownValue) || !isPlainObject(parentValue)) {
      return ownValue;
    }

    // Both sides contribute an object at this path: fall back to the memoized full merge so the subtree stays
    // referentially stable.
    return getByPath(getState(), path);
  };

  const getPath: GetPath<TState> = <P extends PathOf<TState>>(path: P): PathValue<TState, P> | undefined => {
    if (!active) {
      return resolve(path);
    }

    if (pathDirty) {
      pathCache.clear();
      pathDirty = false;
    } else if (pathCache.has(path)) {
      return pathCache.get(path) as PathValue<TState, P> | undefined;
    }

    const result = resolve(path);
    pathCache.set(path, result);

    return result;
  };

  return {
    getState,
    getPath,
    invalidate: () => {
      stateDirty = true;
      pathDirty = true;
    },
    setActive: next => {
      active = next;
      if (!next) {
        pathCache.clear();
        merged = undefined;
        stateDirty = true;
        pathDirty = false;
      }
    },
    getMergeCount: () => mergeCount
  };
}
