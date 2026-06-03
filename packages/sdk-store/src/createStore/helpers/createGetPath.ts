/* eslint-disable @typescript-eslint/no-unnecessary-condition */
// Deferred generic `PathValue<TState, P>` can't be resolved by the type-aware lint, so `=== undefined` guards on
// path reads are flagged as "always true" — same reason this rule is disabled in `hooks/shared.ts`.

import { isPlainObject } from './deepMerge';
import getByPath from '../../helpers/getByPath';

import type { GetState, PathOf, PathValue, StoreApi } from '../../types';

// Resolves a single path through the chain without building the full merged state. Most reads from a nested
// scope are for a path the scope does not own (e.g. globals) → we walk straight to the owner. Only when both this
// scope and the chain contribute an object at the exact path do we fall back to the memoized full merge (rarer,
// e.g. reading a whole `runtime.sources` slice) so the result stays referentially stable.
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
