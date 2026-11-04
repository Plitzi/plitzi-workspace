import { describe, expect, it } from 'vitest';

import { replaceEqualDeep } from './replaceEqualDeep';

describe('replaceEqualDeep', () => {
  it('keeps the previous value whole when the next is equal all through', () => {
    const previous = { spaces: [{ id: 1, name: 'A', tags: ['x'] }], total: 1 };
    const next = { spaces: [{ id: 1, name: 'A', tags: ['x'] }], total: 1 };

    expect(replaceEqualDeep(previous, next)).toBe(previous);
  });

  // The rows that did not change are the same objects: a list keyed by them draws only the one that did.
  it('keeps every part that did not change, and takes the parts that did', () => {
    const previous = {
      spaces: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ],
      total: 2
    };
    const next = {
      spaces: [
        { id: 1, name: 'A' },
        { id: 2, name: 'Bee' }
      ],
      total: 2
    };
    const merged = replaceEqualDeep(previous, next);

    expect(merged).toEqual(next);
    expect(merged).not.toBe(previous);
    expect(merged.spaces[0]).toBe(previous.spaces[0]);
    expect(merged.spaces[1]).toBe(next.spaces[1]);
  });

  it('notices a key gone, a key added, an item gone, and a change of type', () => {
    expect(replaceEqualDeep({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
    expect(replaceEqualDeep({ a: 1 }, { a: 1, b: undefined })).toEqual({ a: 1, b: undefined });
    expect(replaceEqualDeep([1, 2], [1])).toEqual([1]);
    expect(replaceEqualDeep({ a: [1] }, { a: { 0: 1 } })).toEqual({ a: { 0: 1 } });
  });

  // Not data: what it holds is not for this to judge.
  it('compares a Date, a Map or a function by identity', () => {
    const at = new Date(0);
    const next = { at: new Date(0) };

    expect(replaceEqualDeep({ at }, next).at).toBe(next.at);
  });
});
