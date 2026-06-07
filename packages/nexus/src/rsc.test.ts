import { describe, it, expect } from 'vitest';

import { createServerSnapshot, isServerSnapshot, stripServerFlag } from './rsc';

describe('createServerSnapshot', () => {
  it('adds the SSR flag to a plain object', () => {
    const data = { a: 1, b: 'hello' };
    const snapshot = createServerSnapshot(data);

    expect(isServerSnapshot(snapshot)).toBe(true);
    // The returned object is the same reference (mutated in place)
    expect(snapshot).toBe(data);
  });

  it('preserves the original data values', () => {
    const data = { user: { name: 'Alice' }, count: 42 };
    const snapshot = createServerSnapshot(data);

    expect(snapshot.user).toEqual({ name: 'Alice' });
    expect(snapshot.count).toBe(42);
  });

  it('is idempotent — calling twice returns the same object', () => {
    const data = { x: 1 };
    const snapshot1 = createServerSnapshot(data);
    const snapshot2 = createServerSnapshot(snapshot1);

    expect(snapshot1).toBe(snapshot2);
  });

  it('does not add enumerable properties (invisible in spread/JSON)', () => {
    const data: Record<string, unknown> = { x: 1 };
    const snapshot = createServerSnapshot(data);

    expect(JSON.stringify(snapshot)).toBe('{"x":1}');
    expect({ ...snapshot }).toEqual({ x: 1 });
    expect(Object.keys(snapshot)).toEqual(['x']);
  });
});

describe('isServerSnapshot', () => {
  it('returns true for a snapshot created by createServerSnapshot', () => {
    expect(isServerSnapshot(createServerSnapshot({ a: 1 }))).toBe(true);
  });

  it('returns false for a plain object', () => {
    expect(isServerSnapshot({ a: 1 })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isServerSnapshot(null)).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isServerSnapshot(42)).toBe(false);
    expect(isServerSnapshot('hello')).toBe(false);
    expect(isServerSnapshot(true)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isServerSnapshot(undefined)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isServerSnapshot([1, 2, 3])).toBe(false);
  });
});

describe('stripServerFlag', () => {
  it('returns a plain object (no flag) from a snapshot', () => {
    const data = { a: 1, b: 2 };
    const snapshot = createServerSnapshot(data);
    const plain = stripServerFlag(snapshot);

    expect(isServerSnapshot(plain)).toBe(false);
    expect(plain).toEqual({ a: 1, b: 2 });
  });

  it('returns a new object (not the same reference)', () => {
    const data = { a: 1 };
    const snapshot = createServerSnapshot(data);
    const plain = stripServerFlag(snapshot);

    expect(plain).not.toBe(snapshot);
  });

  it('is a no-op for a plain object without the flag', () => {
    const data = { x: 10 };
    const result = stripServerFlag(data);

    expect(result).toBe(data); // same reference, no copy
  });

  it('is a no-op for a nested object without the flag', () => {
    const data = { nested: { deep: true } };
    const result = stripServerFlag(data);

    expect(result).toBe(data);
  });
});
