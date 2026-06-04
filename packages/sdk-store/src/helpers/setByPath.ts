/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

import parsePath from './parsePath';

type AnyObject = Record<string | number, any>;

// Numeric string segments address array indices, so coerce them (matching the legacy behaviour).
const toKey = (segment: string | number): string | number =>
  typeof segment === 'number' ? segment : segment !== '' && !isNaN(Number(segment)) ? Number(segment) : segment;

// Walks the pre-split keys by index instead of `[first, ...rest]`, which would allocate a fresh rest array at every
// level (O(depth²) garbage per write). Each level clones only its own container — the structural-sharing copy.
const setByKeys = (obj: AnyObject, keys: ReadonlyArray<string | number>, index: number, value: any): any => {
  const key = toKey(keys[index]);
  if (index === keys.length - 1) {
    return { ...obj, [key]: value };
  }

  return { ...obj, [key]: setByKeys(obj[key] ?? {}, keys, index + 1, value) };
};

const setByPath = <T extends AnyObject>(obj: T, path: string | (string | number)[], value: any): T => {
  if (typeof path === 'string') {
    if (!path) {
      return value;
    }

    // Single segment (the common case): clone one level, no split, no recursion, no array allocation.
    if (path.indexOf('.') === -1) {
      return { ...obj, [toKey(path)]: value };
    }

    return setByKeys(obj, parsePath(path), 0, value) as T;
  }

  if (!Array.isArray(path) || !path.length) {
    return value;
  }

  return setByKeys(obj, path, 0, value) as T;
};

export default setByPath;
