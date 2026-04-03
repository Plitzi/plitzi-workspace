/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PathOf, PathValue } from '../../types/StoreTypes';

function getByPath<TState, P extends PathOf<TState> | PathOf<TState>[]>(obj: TState, path: P): PathValue<TState, P>;

function getByPath<TState, P extends '' | undefined>(obj: TState, path: P): TState;

function getByPath<TState, P extends PathOf<TState> | PathOf<TState>[] | '' | undefined>(obj: TState, path: P) {
  let current: any = obj;
  const isArray = Array.isArray(path);
  if (typeof path !== 'string' && !isArray) {
    return current as PathValue<TState, P>;
  }

  const keys = isArray ? path : path ? path.split('.') : [];
  for (const key of keys) {
    if (typeof current === 'object' && current !== null && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current as PathValue<TState, P> | TState;
}

export default getByPath;
