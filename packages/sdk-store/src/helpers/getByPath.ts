/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import parsePath from './parsePath';

import type { PathOf, PathValue } from '../types';

function getByPath<TState, P extends '' | undefined | []>(obj: TState, path: P): TState | undefined;

function getByPath<TState, P extends PathOf<TState> | PathOf<TState>[]>(
  obj: TState,
  path: P
): PathValue<TState, P> | undefined;

function getByPath<TState, P extends PathOf<TState> | PathOf<TState>[] | '' | undefined>(obj: TState, path: P) {
  const isArray = Array.isArray(path);
  if ((typeof path !== 'string' && !isArray) || (isArray && !path.length) || (typeof path === 'string' && !path)) {
    return obj as PathValue<TState, P>;
  }

  // Single segment (the common case): read one key, no split, no array allocation.
  if (typeof path === 'string' && path.indexOf('.') === -1) {
    return typeof obj === 'object' && obj !== null && path in obj ? (obj as Record<string, unknown>)[path] : undefined;
  }

  const keys = isArray ? path : parsePath(path);
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

export default getByPath;
