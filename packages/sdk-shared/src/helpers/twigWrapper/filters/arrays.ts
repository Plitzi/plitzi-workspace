import { ARROW_PARAMS, isCallback, isList } from './types';
import { compareValues, toStr } from './values';
import { isRecord } from '../../isRecord';

import type { TwigFilter } from './types';

export const arrayTransformFilters: Record<string, TwigFilter> = {
  // `| sort` — sorts an array. Optional arrow argument: `sort(a => a.key)` sorts by an extracted key,
  // `sort((a, b) => …)` uses the arrow as a comparator.
  sort: (value, args) => {
    if (!isList(value)) {
      return value;
    }

    const arr = [...value];
    const callback = args[0];
    if (isCallback(callback)) {
      const cb = callback;
      if ((cb[ARROW_PARAMS] ?? 1) >= 2) {
        return arr.sort((a, b) => Number(cb(a, b)));
      }

      return arr.sort((a, b) => compareValues(cb(a), cb(b)));
    }

    return arr.sort(compareValues);
  },
  // `| batch(3)` — chunks an array into groups of N.
  batch: (value, args) => {
    if (!isList(value) || args.length === 0) {
      return value;
    }

    const size = Number(args[0]);
    if (size <= 0) {
      return value;
    }

    const chunks: unknown[][] = [];
    for (let i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }

    return chunks;
  },
  // `| map(callback)` — applies a callback to each element and returns the results.
  // The callback is an arrow function, e.g. `| map(item => item.name)`.
  map: (value, args) => {
    if (!isList(value) || args.length === 0) {
      return value;
    }

    const callback = args[0];
    if (!isCallback(callback)) {
      return value;
    }

    return value.map((item, index) => callback(item, index));
  },
  // `| reduce(callback, initial)` — reduces an array to a single value.
  // The callback is an arrow function, e.g. `| reduce((acc, item) => acc + item, 0)`.
  reduce: (value, args) => {
    if (!isList(value) || args.length === 0) {
      return value;
    }

    const callback = args[0];
    if (!isCallback(callback)) {
      return value;
    }

    const initial = args[1];
    const startIndex = initial !== undefined ? 0 : 1;
    let accumulator = initial !== undefined ? initial : value[0];

    for (let i = startIndex; i < value.length; i++) {
      accumulator = callback(accumulator, value[i], i);
    }

    return accumulator;
  },
  // `| merge(other)` — merges two arrays or objects.
  merge: (value, args) => {
    if (args.length === 0) {
      return value;
    }

    const other = args[0];

    if (isList(value) && isList(other)) {
      return [...value, ...other];
    }

    if (typeof value === 'object' && value !== null && typeof other === 'object' && other !== null && !isList(other)) {
      return { ...(value as Record<string, unknown>), ...(other as Record<string, unknown>) };
    }

    return value;
  },
  // `| keys` — returns the keys of an object as an array.
  keys: value => (isRecord(value) ? Object.keys(value) : value),
  // `| values` — returns the values of an object as an array.
  values: value => {
    if (isRecord(value)) {
      return Object.values(value);
    }

    return value;
  },
  // `| filter('key')` or `| filter(callback)` — filters an array by key truthiness or arrow callback.
  filter: (value, args) => {
    if (!isList(value)) {
      return value;
    }

    if (args.length === 0) {
      return value.filter(Boolean);
    }

    const callback = args[0];
    if (isCallback(callback)) {
      return value.filter((item, index) => callback(item, index));
    }

    const key = toStr(callback);
    return value.filter(item => {
      if (item !== null && typeof item === 'object') {
        const resolved = (item as Record<string, unknown>)[key];
        return resolved !== undefined && resolved !== null && resolved !== false && resolved !== '';
      }

      return Boolean(item);
    });
  },
  // `| column(name)` — extracts a property from each item in an array of objects.
  column: (value, args) => {
    if (!isList(value) || args.length === 0) {
      return value;
    }

    const key = toStr(args[0]);

    return value.map(item =>
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined
    );
  }
};
