import type { PropChange } from '../../types';

const MAX_STRING = 40;
const MAX_ENTRIES = 4;
// Bounds the diff so a wholesale data swap can't produce a huge per-render payload.
const MAX_CHANGES = 12;

// One level of a value, never recursing: nested objects/arrays collapse to `{…}`/`[…]` so the preview stays bounded
// and cycle-safe while still showing the actual scalar contents of the top level.
const previewScalar = (value: unknown): string => {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  const type = typeof value;
  if (type === 'function') {
    return 'ƒ';
  }

  if (type === 'string') {
    const text = value as string;

    return JSON.stringify(text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…` : text);
  }

  if (type === 'symbol') {
    return (value as symbol).toString();
  }

  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return `${value as number | boolean | bigint}`;
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[…${value.length}]`;
  }

  return '$$typeof' in (value as Record<string, unknown>) ? '<ReactElement>' : '{…}';
};

// A short, allocation-cheap, cycle-safe one-line preview of any value. Objects/arrays show ONE level of their actual
// contents (scalars inline, nested refs collapsed), so a changed prop reveals what the value is — not merely its keys.
export const previewValue = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return previewScalar(value);
  }

  if ('$$typeof' in (value as Record<string, unknown>)) {
    return '<ReactElement>';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const head = value.slice(0, MAX_ENTRIES).map(previewScalar).join(', ');

    return `[${head}${value.length > MAX_ENTRIES ? ', …' : ''}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) {
    return '{}';
  }

  const head = keys
    .slice(0, MAX_ENTRIES)
    .map(key => `${key}: ${previewScalar(record[key])}`)
    .join(', ');

  return `{ ${head}${keys.length > MAX_ENTRIES ? ', …' : ''} }`;
};

// Shallow value equality: two distinct references whose own enumerable entries are all `Object.is`-equal. Used to spot
// the classic memoization smell — a brand-new object/array with identical contents — so the panel can flag it.
const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(key => Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
};

// Shallow diff of two flat input snapshots → the keys whose values are not `Object.is`-equal, each with a before/after
// preview. `ref` marks a reference-only change (new object/array, shallow-equal content) — almost always an
// unnecessary re-render from a missing memo. Returns empty on first render (a mount is labelled by phase, not a diff).
export const diffProps = (prev: Record<string, unknown> | undefined, next: Record<string, unknown>): PropChange[] => {
  if (!prev) {
    return [];
  }

  const changes: PropChange[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    const before = prev[key];
    const after = next[key];
    if (!Object.is(before, after)) {
      changes.push({ key, prev: previewValue(before), next: previewValue(after), ref: shallowEqual(before, after) });
      if (changes.length >= MAX_CHANGES) {
        break;
      }
    }
  }

  return changes;
};
