import { ARROW_PARAMS } from './types';
import { compareValues, toStr } from './values';

import type { ArrowCallback, TwigFilter } from './types';

export const arrayTransformFilters: Record<string, TwigFilter> = {
  // `| sort` — sorts an array. Optional arrow argument: `sort(a => a.key)` sorts by an extracted key,
  // `sort((a, b) => …)` uses the arrow as a comparator.
  sort: (value, args) => {
    if (!Array.isArray(value)) {
      return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const arr = [...value];
    const callback = args[0];
    if (typeof callback === 'function') {
      const cb = callback as ArrowCallback;
      if ((cb[ARROW_PARAMS] ?? 1) >= 2) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return arr.sort((a, b) => Number(cb(a, b)));
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return arr.sort((a, b) => compareValues(cb(a), cb(b)));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return arr.sort(compareValues);
  },
  // `| batch(3)` — chunks an array into groups of N.
  batch: (value, args) => {
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
  // `| map(callback)` — applies a callback to each element and returns the results.
  // The callback is an arrow function, e.g. `| map(item => item.name)`.
  map: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const callback = args[0];
    if (typeof callback !== 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return value.map((item, index) => callback(item, index));
  },
  // `| reduce(callback, initial)` — reduces an array to a single value.
  // The callback is an arrow function, e.g. `| reduce((acc, item) => acc + item, 0)`.
  reduce: (value, args) => {
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const callback = args[0];
    if (typeof callback !== 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    const initial = args[1];
    const startIndex = initial !== undefined ? 0 : 1;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let accumulator = initial !== undefined ? initial : value[0];

    for (let i = startIndex; i < value.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      accumulator = callback(accumulator, value[i], i);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return accumulator;
  },
  // `| merge(other)` — merges two arrays or objects.
  merge: (value, args) => {
    if (args.length === 0) {
      return value;
    }

    const other = args[0];

    if (Array.isArray(value) && Array.isArray(other)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
      return [...value, ...other];
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      typeof other === 'object' &&
      other !== null &&
      !Array.isArray(other)
    ) {
      return { ...(value as Record<string, unknown>), ...(other as Record<string, unknown>) };
    }

    return value;
  },
  // `| keys` — returns the keys of an object as an array.
  keys: value => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : value),
  // `| values` — returns the values of an object as an array.
  values: value => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Object.values(value);
    }

    return value;
  },
  // `| filter('key')` or `| filter(callback)` — filters an array by key truthiness or arrow callback.
  filter: (value, args) => {
    if (!Array.isArray(value)) {
      return value;
    }

    if (args.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.filter(Boolean);
    }

    const callback = args[0];
    if (typeof callback === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return value.filter((item, index) => callback(item, index));
    }

    const key = toStr(callback);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
    if (!Array.isArray(value) || args.length === 0) {
      return value;
    }

    const key = toStr(args[0]);

    return value.map(item =>
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined
    );
  }
};
