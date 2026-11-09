import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { get } from './get';
import { set } from './set';

describe('set', () => {
  it('sets deep value', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'a.b.c', 5);
    expect(get(obj, 'a.b.c')).toBe(5);
  });

  it('creates nested arrays', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'list[0].name', 'john');
    expect(get(obj, 'list[0].name')).toBe('john');
  });

  it('overwrites existing primitive with object', () => {
    const obj: Record<string, unknown> = { a: 1 };
    set(obj, 'a.b', 10);
    expect(get(obj, 'a.b')).toBe(10);
  });

  it('handles array paths as arrays', () => {
    const obj: Record<string, unknown> = {};
    set(obj, ['a', 'b', 'c'], 15);
    expect(get(obj, 'a.b.c')).toBe(15);
  });

  it('handles arrays', () => {
    const obj = [] as { name: string }[];
    set(obj, '[0].name', 'john');
    expect(get(obj, '[0].name')).toBe('john');
  });

  it('set with empty path does nothing', () => {
    const obj: Record<string, unknown> = { a: 1 };
    set(obj, '', 5);
    expect(obj).toEqual({ a: 1 });
  });

  it('set overwrites primitive with object when needed', () => {
    const obj: Record<string, unknown> = { a: 1 };
    set(obj, 'a.b.c', 10);
    expect(get(obj, 'a.b.c')).toBe(10);
  });

  it('sets inside existing array', () => {
    const obj = { list: [{ name: 'john' }] };
    set(obj, 'list[0].age', 30);
    expect(get(obj, 'list[0].age')).toBe(30);
  });

  it('creates nested arrays automatically', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'a[0][1].value', 'test');
    expect(get(obj, 'a[0][1].value')).toBe('test');
  });

  it('overwrites existing non-object path segment', () => {
    const obj: Record<string, unknown> = { a: 1 };
    set(obj, 'a.b', 2);
    expect(get(obj, 'a.b')).toBe(2);
  });

  it('behaves the same as lodash', () => {
    const obj1: Record<string, unknown> = {};
    const obj2: Record<string, unknown> = {};
    set(obj1, 'a.b.c', 10);
    _.set(obj2, 'a.b.c', 10);
    expect(obj1).toEqual(obj2);
    set(obj1, 'list[0].x', 5);
    _.set(obj2, 'list[0].x', 5);
    expect(obj1).toEqual(obj2);
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
    const obj1 = structuredClone(obj);
    const obj2 = structuredClone(obj);
    set(obj1, 'user.credentials.token', 'efgh');
    _.set(obj2, 'user.credentials.token', 'efgh');
    expect(obj1).toEqual(obj2);
    set(obj1, 'user.addresses[1].zip', 9999);
    _.set(obj2, 'user.addresses[1].zip', 9999);
    expect(obj1).toEqual(obj2);
    set(obj1, 'items[2].value', 'c');
    _.set(obj2, 'items[2].value', 'c');
    expect(obj1).toEqual(obj2);
  });

  test('stress test: set works on large object', () => {
    const bigObj: {
      key9999?: { nested: { deep: number } };
      key0?: { value: number };
      newKey?: { deep: { value: number } };
    } & { [key: string]: { value: number } } = {};
    for (let i = 0; i < 10000; i++) {
      bigObj[`key${i}`] = { value: i };
    }
    set(bigObj, 'key9999.nested.deep', 12345);
    expect(bigObj.key9999?.nested.deep).toBe(12345);
    set(bigObj, 'key0.value', 111);
    expect(bigObj.key0?.value).toBe(111);
    set(bigObj, 'newKey.deep.value', 42);
    expect(bigObj.newKey?.deep.value).toBe(42);
  }, 5000);
});
