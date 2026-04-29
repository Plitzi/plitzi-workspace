/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import type { PathOf, PathValue } from '../types';

function getByPath<TState, P extends '' | undefined | []>(obj: TState, path: P): TState | undefined;

function getByPath<TState, P extends PathOf<TState> | PathOf<TState>[]>(
  obj: TState,
  path: P
): PathValue<TState, P> | undefined;

function getByPath<TState, P extends PathOf<TState> | PathOf<TState>[] | '' | undefined>(obj: TState, path: P) {
  let current: TState | PathValue<TState, P> = obj;

  const isArray = Array.isArray(path);
  if ((typeof path !== 'string' && !isArray) || (isArray && !path.length) || (typeof path === 'string' && !path)) {
    return current as PathValue<TState, P>;
  }

  const keys = isArray ? path : path ? path.split('.') : [];
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key] as PathValue<TState, P>;
  }

  return current;
}

export default getByPath;
