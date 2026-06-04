/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import parsePath from './parsePath';

import type { PathOf, PathValue } from '../types';

// Cached accessor functions — `getByPath` is called on every path read,
// setState equality check, and notification.  For dotted paths the same
// segments are parsed and looped over repeatedly; caching a closure over
// the pre-parsed keys avoids the split + loop overhead on every call.
const cached = new Map<string, (obj: unknown) => unknown>();
const MAX_CACHED = 512;

const makeAccessor = (keys: readonly string[]): ((obj: unknown) => unknown) => {
  // Single key: same fast path as the inline check below.
  if (keys.length === 1) {
    const key = keys[0];

    return obj =>
      typeof obj === 'object' && obj !== null && key in obj ? (obj as Record<string, unknown>)[key] : undefined;
  }

  // Multi-key: a light loop that bails on nullish / non-object intermediates.
  return obj => {
    let current: unknown = obj;

    for (let i = 0; i < keys.length; i++) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[keys[i]];
    }

    return current;
  };
};

const getAccessor = (path: string): ((obj: unknown) => unknown) => {
  let fn = cached.get(path);

  if (!fn) {
    fn = makeAccessor(parsePath(path));

    if (cached.size >= MAX_CACHED) {
      const first = cached.keys().next().value as string;

      cached.delete(first);
    }
    cached.set(path, fn);
  }

  return fn;
};

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

  // Multi-segment string path: use the cached accessor.
  if (typeof path === 'string') {
    return getAccessor(path)(obj);
  }

  // Array path (e.g. from a multi-path subscriber): walk directly, no cache.
  const keys = path;
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
