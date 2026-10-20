import { wrapRaw } from './raw';
import { isEmpty, toJson, toStr } from './values';

import type { TwigFilter } from './types';

export const identityFilters: Record<string, TwigFilter> = {
  // Outputs the value as-is, bypassing JSON serialization even in double braces.
  raw: value => wrapRaw(value)
};

export const serialisationFilters: Record<string, TwigFilter> = {
  // Twig's: the value as JSON, whatever it is — a string quoted and escaped, nothing at all as `null` — so what it
  // prints can always be put inside a JSON document. Encoding objects alone printed `null` as nothing and a string
  // bare, and the document around them stopped being JSON.
  to_json: value => toJson(value),
  json_encode: value => toJson(value),
  // Serialises an object so an asRaw result can be JSON.parsed back into typed data; leaves primitives untouched.
  object_as_json: value => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value)
};

export const defaultFilters: Record<string, TwigFilter> = {
  // The idiomatic default: substitutes the argument when the value is undefined, null or an empty string.
  default: (value, args) => (isEmpty(value) ? args[0] : value)
};

export const stringTransformFilters: Record<string, TwigFilter> = {
  upper: value => (typeof value === 'string' ? value.toUpperCase() : value),
  lower: value => (typeof value === 'string' ? value.toLowerCase() : value),
  trim: value => (typeof value === 'string' ? value.trim() : value),
  // Twig-style: first character uppercase, the rest lowercase.
  capitalize: value =>
    typeof value === 'string' && value.length > 0 ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value,
  // `| title` uppercases the first letter of each word.
  title: value => (typeof value === 'string' ? value.replace(/\b\w/g, char => char.toUpperCase()) : value),
  // Converts to CamelCase (e.g. `foo_bar` → `fooBar`).
  camelize: value =>
    typeof value === 'string'
      ? value.replace(/[-_]+(.)?/g, (_, char: string | undefined) => (char ? char.toUpperCase() : ''))
      : value,
  // Converts to kebab-case (e.g. `fooBar` → `foo-bar`).
  kebab: value =>
    typeof value === 'string'
      ? value
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase()
      : value,
  // Converts to snake_case (e.g. `fooBar` → `foo_bar`).
  snake: value =>
    typeof value === 'string'
      ? value
          .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
          .replace(/[\s-]+/g, '_')
          .toLowerCase()
      : value,
  // `| ltrim` — trims whitespace from the start.
  ltrim: value => (typeof value === 'string' ? value.trimStart() : value),
  // `| rtrim` — trims whitespace from the end.
  rtrim: value => (typeof value === 'string' ? value.trimEnd() : value),
  // `| pad(length, 'char')` — pads string from left to given length.
  pad: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }
    const length = Number(args[0]) || 0;
    const padStr = args.length > 1 ? toStr(args[1]) : ' ';
    if (padStr === '') {
      return value;
    }
    const padLen = length - value.length;
    if (padLen <= 0) {
      return value;
    }
    const repeat = Math.ceil(padLen / padStr.length);
    return padStr.repeat(repeat).slice(0, padLen) + value;
  },
  // `| padRight(length, 'char')` — pads string from right to given length.
  padRight: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }
    const length = Number(args[0]) || 0;
    const padStr = args.length > 1 ? toStr(args[1]) : ' ';
    if (padStr === '') {
      return value;
    }
    const padLen = length - value.length;
    if (padLen <= 0) {
      return value;
    }
    const repeat = Math.ceil(padLen / padStr.length);
    return value + padStr.repeat(repeat).slice(0, padLen);
  },
  // `| number` — extracts the first number from a string.
  number: (value, args) => {
    if (typeof value === 'number') {
      const decimals = Number(args[0]) || 0;
      return value.toFixed(decimals);
    }
    if (typeof value !== 'string') {
      return value;
    }
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }
};

export const stringOperationFilters: Record<string, TwigFilter> = {
  // `| replace('search', 'replacement')` — replaces every occurrence of search with replacement. Twig's own form,
  // `| replace({'search': 'replacement', …})`, replaces each key with its value in one pass, the longest key first where
  // two start at one place (PHP's strtr): what is put in is never replaced again.
  replace: (value, args) => {
    if (typeof value !== 'string' || args.length === 0) {
      return value;
    }

    const [first] = args;
    if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
      const pairs = new Map(Object.entries(first).filter(([key]) => key !== ''));
      if (pairs.size === 0) {
        return value;
      }

      const keys = [...pairs.keys()].sort((a, b) => b.length - a.length);
      const pattern = new RegExp(keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

      return value.replace(pattern, found => toStr(pairs.get(found)));
    }

    return value.split(toStr(first)).join(toStr(args[1]));
  },
  // `| slice(2)` or `| slice(2, 5)` — substring or sub-array via start/length.
  slice: (value, args) => {
    if (args.length === 0) {
      return value;
    }

    const start = Number(args[0]) || 0;
    const hasLength = args.length > 1 && Number.isFinite(Number(args[1]));
    const end = hasLength ? start + Number(args[1]) : undefined;

    if (typeof value === 'string') {
      return value.slice(start, end);
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.slice(start, end);
    }

    return value;
  },
  // `| split(',')` — splits a string into an array.
  split: (value, args) => (typeof value === 'string' && args.length > 0 ? value.split(toStr(args[0])) : value),
  // `| join(', ')` — joins an array into a string.
  join: (value, args) => (Array.isArray(value) ? value.join(args.length === 0 ? '' : toStr(args[0])) : value),
  // `| reverse` — reverses a string or array.
  reverse: value => {
    if (typeof value === 'string') {
      return value.split('').reverse().join('');
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
      return [...value].reverse();
    }

    return value;
  }
};

export const stringQueryFilters: Record<string, TwigFilter> = {
  length: value => {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }

    if (typeof value === 'number') {
      return toStr(value).length;
    }

    if (value !== null && typeof value === 'object') {
      return Object.keys(value).length;
    }

    return 0;
  },
  // `| first` — first character of a string or first element of an array.
  first: value => {
    if (typeof value === 'string') {
      return value.length > 0 ? value[0] : '';
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.length > 0 ? value[0] : undefined;
    }

    return value;
  },
  // `| last` — last character of a string or last element of an array.
  last: value => {
    if (typeof value === 'string') {
      return value.length > 0 ? value[value.length - 1] : '';
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.length > 0 ? value[value.length - 1] : undefined;
    }

    return value;
  },
  // `| contains('substr')` or `| contains(item)` — checks string substring or array membership.
  contains: (value, args) => {
    if (args.length === 0) {
      return false;
    }

    const needle = args[0];

    if (typeof value === 'string') {
      return value.includes(toStr(needle));
    }

    if (Array.isArray(value)) {
      return value.includes(needle);
    }

    return false;
  },
  // `| startswith('prefix')` — checks if a string starts with a prefix.
  startswith: (value, args) =>
    typeof value === 'string' && args.length > 0 ? value.startsWith(toStr(args[0])) : false,
  // `| endswith('suffix')` — checks if a string ends with a suffix.
  endswith: (value, args) => (typeof value === 'string' && args.length > 0 ? value.endsWith(toStr(args[0])) : false)
};
