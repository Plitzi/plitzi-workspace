import { toStr } from './values';

import type { TwigFilter } from './types';

export const objectFilters: Record<string, TwigFilter> = {
  // `| without('key1', 'key2')` — returns object without specified keys.
  without: (value, args) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const keys = args.map(toStr);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!keys.includes(k)) {
        result[k] = v;
      }
    }
    return result;
  },
  // `| only('key1', 'key2')` — returns object with only specified keys.
  only: (value, args) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const keys = args.map(toStr);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keys.includes(k)) {
        result[k] = v;
      }
    }
    return result;
  }
};

export const queryFilters: Record<string, TwigFilter> = {
  // `| find(callback)` or `| find('key', value)` — finds first array element matching criteria.
  find: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return undefined;
    }

    const callback = args[0];
    if (typeof callback === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return value.find((item, index) => callback(item, index));
    }

    if (args.length < 2) {
      return undefined;
    }

    const key = toStr(callback);
    const target = args[1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value.find(item => {
      if (item !== null && typeof item === 'object') {
        return (item as Record<string, unknown>)[key] === target;
      }
      return item === target;
    });
  },
  // `| pluck('key')` — extracts all values for a given key from an array of objects.
  pluck: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const key = toStr(args[0]);

    return value.map(item =>
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined
    );
  },
  // `| unique` — removes duplicates from an array.
  unique: value => (Array.isArray(value) ? [...new Set(value)] : value),
  // `| flatten` — flattens a nested array by one level.
  flatten: value => {
    return Array.isArray(value) ? value.flat() : value;
  },
  // `| sum` — sums all numeric values in an array.
  sum: value => {
    if (!Array.isArray(value)) {
      return value;
    }
    return value.reduce<number>((acc, item) => acc + (typeof item === 'number' ? item : 0), 0);
  },
  // `| chunk(size)` — splits array into chunks of given size.
  chunk: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const size = Number(args[0]);
    if (size <= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }
    const chunks: unknown[][] = [];
    for (let i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }
    return chunks;
  },
  // `| index_by(key)` — reindexes an array of objects by a key.
  index_by: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const key = toStr(args[0]);
    const result: Record<string, unknown> = {};
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const k = String((item as Record<string, unknown>)[key] ?? '');
        result[k] = item;
      }
    }
    return result;
  },
  // `| group_by(key)` — groups array elements by a key.
  group_by: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }
    const key = toStr(args[0]);
    const result: Record<string, unknown[]> = {};
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const k = String((item as Record<string, unknown>)[key] ?? '');
        result[k] = result[k] ?? [];
        result[k].push(item);
      }
    }
    return result;
  }
};
