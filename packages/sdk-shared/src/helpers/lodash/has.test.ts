import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { has } from './has';

describe('has', () => {
  const obj = { a: { b: { c: 1 }, d: 2 }, e: null };

  it('returns true for existing paths', () => {
    expect(has(obj, 'a.b.c')).toBe(true);
    expect(has(obj, ['a', 'b', 'c'])).toBe(true);
    expect(has(obj, 'a.d')).toBe(true);
  });

  it('returns false for non-existing paths', () => {
    expect(has(obj, 'a.b.x')).toBe(false);
    expect(has(obj, ['a', 'b', 'x'])).toBe(false);
    expect(has(obj, 'z')).toBe(false);
  });

  it('handles null or undefined object', () => {
    expect(has(null, 'a.b')).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(has(undefined as unknown as Record<string, any>, 'a')).toBe(false);
  });

  it('handles root level keys correctly', () => {
    expect(has(obj, 'e')).toBe(true);
    expect(has(obj, 'f')).toBe(false);
  });

  it('behaves the same as lodash', () => {
    const obj = {
      user: {
        name: 'alice',
        credentials: { password: '1234', token: 'abcd' },
        addresses: [
          { city: 'Lisbon', zip: 1000 },
          { city: 'Porto', zip: 2000 }
        ]
      },
      items: [{ id: 1, value: 'a' }],
      meta: null
    };

    const paths = [
      'user.name',
      'user.credentials.password',
      'user.addresses[1].zip',
      'items[0].value',
      'meta',
      'missing.path'
    ];

    for (const p of paths) {
      expect(has(obj, p)).toBe(_.has(obj, p));
    }
  });

  test('stress test: has works on large object', () => {
    const bigObj: Record<string, { value: number }> = {};
    for (let i = 0; i < 10000; i++) {
      bigObj[`key${i}`] = { value: i };
    }
    expect(has(bigObj, 'key9999.value')).toBe(true);
    expect(has(bigObj, 'key0.value')).toBe(true);
    expect(has(bigObj, 'key10000')).toBe(false);
  }, 5000);
});
