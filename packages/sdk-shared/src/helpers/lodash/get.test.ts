import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { get } from './get';

describe('get', () => {
  const obj = {
    a: {
      b: { c: 1 },
      list: [{ name: 'john', age: 30 }]
    }
  };

  it('get value', () => {
    type T = Record<string, object>;
    const obj = {} as { [K in keyof T]?: string | undefined };
    const value = get(obj, 'a');
    expect(value).toBeUndefined();
    const obj2 = {} as { a?: boolean };
    const value2 = get(obj2, 'a', false);
    expect(value2).toBe(false);
  });

  it('returns defaultValue when property is missing', () => {
    const element: Record<string, unknown> = {};
    const visibility = get<Record<string, unknown>, 'definition.initialState.visibility', boolean>(
      element,
      'definition.initialState.visibility',
      true
    );
    expect(visibility).toBe(true);
    const nestedVisibility = get<Record<string, unknown>, ['definition', 'initialState', 'visibility'], boolean>(
      element,
      ['definition', 'initialState', 'visibility'],
      false
    );
    expect(nestedVisibility).toBe(false);
  });

  it('returns actual value if it exists', () => {
    const element: Record<string, unknown> = {
      definition: { initialState: { visibility: false } }
    };
    const visibility = get(element, 'definition.initialState.visibility', true);
    expect(visibility).toBe(false);
    const nestedVisibility = get(element, ['definition', 'initialState', 'visibility'], true);
    expect(nestedVisibility).toBe(false);
  });

  it('empty path', () => {
    expect(get(obj, '')).toBeUndefined();
    expect(get(obj, '', 'default')).toBe('default');
  });

  it('gets deep value', () => {
    expect(get(obj, 'a.b.c')).toBe(1);
  });

  it('gets array index', () => {
    const value = get(obj, 'a.list[0].name');
    expect(value).toBe('john');
    const valueAge = get(obj, 'a.list[0].age');
    expect(valueAge).toBe(30);
  });

  it('returns default', () => {
    expect(get(obj, 'a.x', 'default')).toBe('default');
  });

  it('reads a list’s length, as lodash does', () => {
    expect(get({ picks: ['rock', 'jazz'] }, 'picks.length')).toBe(2);
    expect(get({ picks: ['rock', 'jazz'] }, 'picks.1')).toBe('jazz');
  });

  it('return value from array path', () => {
    const arr = [{ name: 'john', details: { age: 30 } }];
    const name = get(arr, '[0].name');
    expect(name).toBe('john');
    const age = get(arr as typeof arr | undefined, '[0].details.age');
    expect(age).toBe(30);
  });

  it('nested objects are typed correctly', () => {
    const obj = { a: { b: { c: 1, d: [{ name: 'test' }] } } };
    const value = get(obj, 'a.b.d[0].name');
    expect(value).toBe('test');
  });

  it('arrays', () => {
    const arr = [{ name: 'john' }, { name: 'doe' }];
    expect(get(arr, '[0].name')).toBe('john');
    expect(get(arr, '[1].name')).toBe('doe');
    expect(get(arr, '0')).toEqual({ name: 'john' });
    expect(get(arr, '1')).toEqual({ name: 'doe' });
    const arr2 = ['john', 'doe'];
    expect(get(arr2, '[0]')).toBe('john');
    expect(get(arr2, '[1]')).toBe('doe');
    expect(get(arr2, '0')).toBe('john');
    expect(get(arr2, '1')).toBe('doe');
  });

  it('Object array', () => {
    const obj = { id1: { name: 'john', profile: { age: 30 } }, id2: { name: 'doe' } } as Record<
      string,
      { name: string; profile?: { age: number } }
    >;
    const value = get(obj, 'id1.name');
    expect(value).toBe('john');
    const value2 = get(obj, 'id1.profile.age');
    expect(value2).toBe(30);
  });

  it('returns undefined for null object', () => {
    expect(get(null, 'a.b')).toBeUndefined();
  });

  it('supports path as array', () => {
    const obj = { a: { b: { c: 42 } } };
    const value = get(obj, ['a', 'b', 'c']);
    expect(value).toBe(42);
  });

  it('returns undefined for empty path string', () => {
    const obj = { a: 1 };
    expect(get(obj, '')).toBeUndefined();
  });

  it('handles numeric string keys', () => {
    const obj = { '123': { value: 'ok' } };
    expect(get(obj, '123.value')).toBe('ok');
  });

  it('works when root is array', () => {
    const obj = [{ name: 'john' }];
    expect(get(obj, '[0].name')).toBe('john');
  });

  it('behaves the same as lodash', () => {
    const obj = { a: { b: { c: 42 }, list: [{ x: 1 }] } };
    expect(get(obj, 'a.b.c')).toEqual(_.get(obj, 'a.b.c'));
    expect(get(obj, '')).toEqual(_.get(obj, ''));
    expect(get(obj, ['a', 'b', 'c'])).toEqual(_.get(obj, ['a', 'b', 'c']));
    expect(get(obj, 'a.list[0].x')).toEqual(_.get(obj, 'a.list[0].x'));
    expect(get(obj, 'a.missing', 'default')).toEqual(_.get(obj, 'a.missing', 'default'));
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
    const paths = [
      'user.name',
      'user.credentials.token',
      'user.addresses[1].city',
      'user.credentials.', // malformed
      'items[0].value',
      'meta',
      'missing.path'
    ];
    for (const p of paths) {
      expect(get(obj, p)).toEqual(_.get(obj, p));
    }
  });

  test('stress test: get works on large object', () => {
    const bigObj: Record<string, unknown> = {};
    for (let i = 0; i < 10000; i++) {
      bigObj[`key${i}`] = { value: i, nested: { deep: i * 2 } };
    }
    expect(get(bigObj, 'key9999.nested.deep')).toBe(19998);
    expect(typeof get(bigObj, 'key5000.value')).toBe('number');
    expect(get(bigObj, 'missing.path', 'default')).toBe('default');
  });
});
