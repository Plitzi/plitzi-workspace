import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { omit } from './omit';

describe('omit', () => {
  const obj = { a: 1, b: 2, c: 3 };

  it('omit works with array of keys', () => {
    const result = omit(obj, ['b']);
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('omit works with single string path', () => {
    const result = omit(obj, 'b');
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('omit works with dynamic key', () => {
    const keyToOmit: string = 'b';
    const result = omit(obj, keyToOmit);
    expect(result).toEqual({ a: 1, c: 3 });
    const result2 = omit(obj, [keyToOmit]);
    expect(result2).toEqual({ a: 1, c: 3 });
  });

  it('optional values are handled correctly', () => {
    const objWithUndefined = { a: 1, b: undefined, c: 3 } as { a: number; b?: number; c: number };
    const omitted = omit(objWithUndefined, ['b']);
    expect(omitted).toEqual({ a: 1, c: 3 });
    const objWithMissingValues = { a: 1, c: 3 } as { a: number; b?: number; c: number };
    const omittedMissing = omit(objWithMissingValues, ['b']);
    expect(omittedMissing).toEqual({ a: 1, c: 3 });
  });

  it('omit with empty paths returns clone', () => {
    const obj = { a: 1 };
    const result = omit(obj, []);
    expect(result).toEqual(obj);
    expect(result).not.toBe(obj);

    const result2 = omit(obj);
    expect(result2).toEqual(obj);
    expect(result2).not.toBe(obj);
  });

  it('deep cases: omits deep nested value', () => {
    const obj = {
      user: {
        name: 'john',
        password: 'secret',
        address: {
          city: 'Lisbon',
          zip: 1000
        }
      },
      list: [{ id: 1, value: 'a' }]
    };
    const result = omit(obj, ['user.password']);
    expect(result).toEqual({
      user: {
        name: 'john',
        address: {
          city: 'Lisbon',
          zip: 1000
        }
      },
      list: [{ id: 1, value: 'a' }]
    });
  });

  it('deep cases: omits multiple deep paths', () => {
    const obj = {
      user: {
        name: 'john',
        password: 'secret',
        address: {
          city: 'Lisbon',
          zip: 1000
        }
      },
      list: [{ id: 1, value: 'a' }]
    };
    const result = omit(obj, ['user.address.zip', 'list[0].value']);
    expect(result).toEqual({
      user: {
        name: 'john',
        password: 'secret',
        address: {
          city: 'Lisbon'
        }
      },
      list: [{ id: 1 }]
    });
  });

  it('deep cases: ignores non-existing paths', () => {
    const obj = {
      user: {
        name: 'john',
        password: 'secret',
        address: {
          city: 'Lisbon',
          zip: 1000
        }
      },
      list: [{ id: 1, value: 'a' }]
    };
    const result = omit(obj, ['user.age']);
    expect(result).toEqual(obj);
  });

  it('deep cases: does not mutate original object', () => {
    const obj = {
      user: {
        name: 'john',
        password: 'secret',
        address: {
          city: 'Lisbon',
          zip: 1000
        }
      },
      list: [{ id: 1, value: 'a' }]
    };
    const result = omit(obj, ['user.password']);
    expect(obj.user.password).toBe('secret');
    expect(result).not.toBe(obj);
  });

  it('removes entire parent path with string', () => {
    const obj = { user: { name: 'john', password: 'secret' } };
    const result = omit(obj, 'user');
    expect(result).toEqual({});
  });

  it('removes deep nested value with string path', () => {
    const obj = {
      user: {
        name: 'john',
        password: 'secret',
        address: { city: 'Lisbon', zip: 1000 }
      },
      list: [{ id: 1, value: 'a' }]
    };
    const result = omit(obj, 'user.password');
    expect(result).toEqual({
      user: { name: 'john', address: { city: 'Lisbon', zip: 1000 } },
      list: [{ id: 1, value: 'a' }]
    });
  });

  it('behaves the same as lodash', () => {
    const obj = { a: 1, b: { c: 2, d: 3 } };
    const result1 = omit(obj, ['a', 'b.c']);
    const result2 = _.omit(obj, ['a', 'b.c']);
    expect(result1).toEqual(result2);
    const result3 = omit(obj, ['a']);
    const result4 = _.omit(obj, ['a']);
    expect(result3).toEqual(result4);
    const result5 = omit(obj, ['b.c']);
    const result6 = _.omit(obj, ['b.c']);
    expect(result5).toEqual(result6);
    const result7 = omit(obj, ['a', 'b']);
    const result8 = _.omit(obj, ['a', 'b']);
    expect(result7).toEqual(result8);
  });

  it('extended comparison with lodash', () => {
    const obj = {
      user: {
        name: 'alice',
        credentials: { password: '1234', token: 'abcd' },
        addresses: [
          { city: 'Lisbon', zip: 1000 },
          { city: 'Porto', zip: 2000 }
        ]
      },
      items: [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' }
      ],
      meta: null
    };
    const paths = ['user.credentials.token', 'user.addresses[1]', 'items[0].value'];
    const result1 = omit(obj, paths);
    const result2 = _.omit(obj, paths);
    expect(result1).toEqual(result2);
  });

  it('works correctly with frozen (immutable) objects', () => {
    const obj = Object.freeze({ a: 1, b: 2, c: 3 });
    const result = omit(obj, ['b']);
    expect(result).toEqual({ a: 1, c: 3 });
    // Original object must remain unchanged
    expect(obj).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('stress test: omit works on large object', () => {
    const bigObj: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      bigObj[`key${i}`] = i;
    }
    const omitKeys = ['key10', 'key9999', 'key5000'];
    const result = omit(bigObj, omitKeys);
    expect(result).not.toHaveProperty('key10');
    expect(result).not.toHaveProperty('key9999');
    expect(result).not.toHaveProperty('key5000');
    expect(result).toHaveProperty('key1', 1);
    expect(typeof result).toBe('object');
  }, 5000);

  it('deek case: nested key', () => {
    const result = omit(obj, ['var1.subVar1']);
    expect(Object.keys(result)).toEqual(['a', 'b', 'c']);

    const lodashResult = _.omit(obj, ['var1.subVar1']);
    expect(Object.keys(lodashResult)).toEqual(['a', 'b', 'c']);
  });

  // Shallow fast-path: when every path is a single top-level key the keys share one root clone instead of one clone
  // per key. These cases lock the behaviour to lodash so the optimisation can never diverge.
  describe('shallow fast-path parity with lodash', () => {
    it('removes several top-level keys (multi-key fast-path)', () => {
      const source = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(source, ['a', 'c']);

      expect(result).toEqual(_.omit(source, ['a', 'c']));
      expect(result).toEqual({ b: 2, d: 4 });
    });

    it('ignores absent keys while still removing present ones', () => {
      const source = { a: 1, b: 2 };
      const result = omit(source, ['a', 'missing', 'alsoMissing']);

      expect(result).toEqual(_.omit(source, ['a', 'missing', 'alsoMissing']));
      expect(result).toEqual({ b: 2 });
    });

    it('matches lodash when no listed key is present', () => {
      const source = { a: 1, b: 2 };

      expect(omit(source, ['x', 'y'])).toEqual(_.omit(source, ['x', 'y']));
      expect(omit(source, ['x', 'y'])).toEqual({ a: 1, b: 2 });
    });

    it('removes a top-level key whose value is an object, not just part of it', () => {
      const source = { user: { name: 'a', token: 't' }, keep: 1 };
      const result = omit(source, ['user']);

      expect(result).toEqual(_.omit(source, ['user']));
      expect(result).toEqual({ keep: 1 });
    });

    it('preserves undefined-valued sibling keys', () => {
      const source = { a: 1, b: undefined, c: 3 } as { a: number; b?: number; c: number };
      const result = omit(source, ['a', 'c']);

      expect(result).toEqual(_.omit(source, ['a', 'c']));
      expect(result).toEqual({ b: undefined });
    });

    it('does not mutate the source and returns a new object when a key is removed', () => {
      const source = { a: 1, b: 2, c: 3 };
      const result = omit(source, ['a', 'b']);

      expect(result).not.toBe(source);
      expect(source).toEqual({ a: 1, b: 2, c: 3 });
      expect(result).toEqual(_.omit(source, ['a', 'b']));
    });

    it('matches lodash on a large object with several shallow keys', () => {
      const source: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        source[`k${i}`] = i;
      }
      const keys = ['k0', 'k500', 'k999'];

      expect(omit(source, keys)).toEqual(_.omit(source, keys));
    });
  });

  // Mixing shallow keys and nested paths in one call must keep both branches correct and order-independent.
  describe('mixed shallow + nested parity with lodash', () => {
    const source = { a: 1, b: { c: 2, d: 3 }, e: 4 };

    it('removes shallow keys and nested paths together', () => {
      const result = omit(source, ['a', 'b.c', 'e']);

      expect(result).toEqual(_.omit(source, ['a', 'b.c', 'e']));
      expect(result).toEqual({ b: { d: 3 } });
      expect(source).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
    });

    it('is independent of the order shallow vs nested paths are listed', () => {
      const forward = omit(source, ['a', 'b.c']);
      const reversed = omit(source, ['b.c', 'a']);

      expect(forward).toEqual(reversed);
      expect(forward).toEqual(_.omit(source, ['a', 'b.c']));
    });
  });
});
