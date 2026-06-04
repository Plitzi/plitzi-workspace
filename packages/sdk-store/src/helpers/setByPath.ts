/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

import parsePath from './parsePath';

type AnyObject = Record<string | number, any>;

// Numeric string segments address array indices, so coerce them.
const toKey = (segment: string | number): string | number =>
  typeof segment === 'number' ? segment : segment !== '' && !isNaN(Number(segment)) ? Number(segment) : segment;

// Walks pre-split keys by index (not `[first, ...rest]`, which allocates a rest array per level). Each level clones
// only its own container — the structural-sharing copy.
const setByKeys = (obj: AnyObject, keys: ReadonlyArray<string | number>, index: number, value: any): any => {
  const key = toKey(keys[index]);
  // `{ ...obj }; next[key] = …` clones ~2x faster than `{ ...obj, [key]: value }` (a computed key drops V8's fast path).
  const next = { ...obj };
  next[key] = index === keys.length - 1 ? value : setByKeys(obj[key] ?? {}, keys, index + 1, value);

  return next;
};

const setByPath = <T extends AnyObject>(obj: T, path: string | (string | number)[], value: any): T => {
  if (typeof path === 'string') {
    if (!path) {
      return value;
    }

    const keys = parsePath(path);
    if (keys.length === 1) {
      const next: AnyObject = { ...obj };
      next[toKey(keys[0])] = value;

      return next as T;
    }

    return setByKeys(obj, keys, 0, value) as T;
  }

  if (!Array.isArray(path) || !path.length) {
    return value;
  }

  return setByKeys(obj, path, 0, value) as T;
};

export default setByPath;
