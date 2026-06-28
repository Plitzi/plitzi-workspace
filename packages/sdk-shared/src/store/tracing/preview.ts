import type { PropChange } from '../../types';

const MAX_STRING = 40;
const MAX_OBJECT_KEYS = 4;
// Bounds the diff so a wholesale data swap can't produce a huge per-render payload.
const MAX_CHANGES = 12;

// A short, allocation-cheap, cycle-safe one-line preview of any value — never walks deep (objects show only their top
// keys), so it's safe to call on the hot render path for every changed prop.
export const previewValue = (value: unknown): string => {
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
    return `Array(${value.length})`;
  }

  if (type === 'object') {
    const record = value as Record<string, unknown>;
    if ('$$typeof' in record) {
      return '<ReactElement>';
    }

    const keys = Object.keys(record);
    if (keys.length === 0) {
      return '{}';
    }

    const head = keys.slice(0, MAX_OBJECT_KEYS).join(', ');

    return `{ ${head}${keys.length > MAX_OBJECT_KEYS ? ', …' : ''} }`;
  }

  return 'unknown';
};

// Shallow diff of two flat input snapshots → the keys whose values are not `Object.is`-equal, each with a before/after
// preview. Returns empty on first render (no previous snapshot) — a mount is already labelled by phase, not a diff.
export const diffProps = (prev: Record<string, unknown> | undefined, next: Record<string, unknown>): PropChange[] => {
  if (!prev) {
    return [];
  }

  const changes: PropChange[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (!Object.is(prev[key], next[key])) {
      changes.push({ key, prev: previewValue(prev[key]), next: previewValue(next[key]) });
      if (changes.length >= MAX_CHANGES) {
        break;
      }
    }
  }

  return changes;
};
