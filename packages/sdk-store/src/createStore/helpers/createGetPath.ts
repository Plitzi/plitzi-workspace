/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { isPlainObject } from './deepMerge';
import getByPath from '../../helpers/getByPath';

import type { GetState, PathOf, PathValue, StoreApi } from '../../types';

// Resolves a single path through the scope chain without materializing the full merged state: walk straight to the
// owner. Only when this scope AND the chain both contribute an object at the path do we fall back to the memoized
// full merge, so the result stays referentially stable.
export function createGetPath<TState extends object>(
  getOwnState: () => TState,
  parent: StoreApi<TState> | undefined,
  getState: GetState<TState>
) {
  return <P extends PathOf<TState>>(path: P): PathValue<TState, P> | undefined => {
    if (!parent) {
      return getByPath(getOwnState(), path);
    }

    const ownValue = getByPath(getOwnState(), path);
    if (ownValue === undefined) {
      return parent.getPath(path);
    }

    const parentValue = parent.getPath(path);
    if (parentValue === undefined || !isPlainObject(ownValue) || !isPlainObject(parentValue)) {
      return ownValue;
    }

    return getByPath(getState(), path);
  };
}
