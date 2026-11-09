/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { cloneAtPath, cloneObject } from './cloneDeep';
import { has } from './has';
import { toPath } from './shared';

import type { Path } from './shared';

export function omit<T extends object>(obj: T): T;

export function omit<T extends Record<string, unknown>, K extends keyof T & string>(
  obj: T,
  paths: K | readonly [K] | readonly K[]
): Omit<T, K>;

export function omit<T extends Record<string, unknown>>(obj: T, paths: Path | readonly Path[]): Partial<T>;

export function omit<T extends Record<string, unknown>>(obj: T, paths?: Path | readonly Path[]): Partial<T> {
  const pathArray: readonly Path[] = Array.isArray(paths) ? paths : paths ? [paths] : [];
  if (pathArray.length === 0) {
    return { ...obj };
  }

  // Classify once: a single-segment path is a top-level key (the common case), the rest are nested paths that need
  // structural-sharing clones. Empty results (invalid paths) are dropped, matching the previous no-op behaviour.
  const shallowKeys: string[] = [];
  const nestedPaths: Path[] = [];
  for (const path of pathArray) {
    const keys = toPath(path);
    if (keys.length === 0) {
      continue;
    }

    if (keys.length === 1) {
      shallowKeys.push(keys[0]);
    } else {
      nestedPaths.push(path);
    }
  }

  let result: T = obj;

  // Shallow keys share a single root clone instead of cloning the source once per key.
  if (shallowKeys.length) {
    let cloned: T | undefined;
    for (const key of shallowKeys) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        cloned ??= cloneObject(result);
        delete (cloned as Record<string, unknown>)[key];
      }
    }

    if (cloned) {
      result = cloned;
    }
  }

  // Nested paths keep the per-path structural-sharing clone.
  for (const path of nestedPaths) {
    const keys = toPath(path);
    if (!has(result, path)) {
      continue;
    }

    const clonedRoot = cloneAtPath(result, path);
    let current: unknown = clonedRoot;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current || typeof current !== 'object') {
        break;
      }

      const k = keys[i];
      current = (current as Record<string, unknown>)[k];
    }

    if (current && typeof current === 'object') {
      const keyToDelete = keys[keys.length - 1];
      if (Object.prototype.hasOwnProperty.call(current, keyToDelete)) {
        delete (current as Record<string, unknown>)[keyToDelete];
      }
    }

    result = clonedRoot;
  }

  return result;
}
