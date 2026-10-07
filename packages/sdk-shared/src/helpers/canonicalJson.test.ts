import { describe, expect, it } from 'vitest';

import { canonicalJson } from './canonicalJson';

describe('canonicalJson', () => {
  it('reads the same for the same keys in another order, at any depth, and keeps the order of a list', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(canonicalJson({ a: { c: null, d: [2, 1] }, b: 1 }));
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it('reads undefined as such', () => {
    expect(canonicalJson(undefined)).toBe('undefined');
  });
});
