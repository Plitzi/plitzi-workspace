import { describe, it, expect } from 'vitest';

import { omitKeys } from './omitKeys';

describe('omitKeys', () => {
  it('removes the listed top-level keys', () => {
    const result = omitKeys({ a: 1, b: 2, c: 3 }, ['b']);

    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('returns a shallow copy, leaving the source untouched', () => {
    const source = { a: 1, nested: { x: 1 } };
    const result = omitKeys(source, ['a']);

    expect(result).toEqual({ nested: source.nested });
    expect(result.nested).toBe(source.nested);
    expect(source).toEqual({ a: 1, nested: { x: 1 } });
  });

  it('ignores keys that are not present', () => {
    expect(omitKeys({ a: 1 }, ['missing'])).toEqual({ a: 1 });
  });

  it('returns a copy with no keys when omitting all of them', () => {
    expect(omitKeys({ a: 1, b: 2 }, ['a', 'b'])).toEqual({});
  });
});
