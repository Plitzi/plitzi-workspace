import { describe, it, expect } from 'vitest';

import getByPath from './getByPath';
import isPathAffected from './isPathAffected';
import parsePath from './parsePath';
import setByPath from './setByPath';
import shallowEqual from './shallowEqual';

describe('shallowEqual', () => {
  it('is true for identical references and equal shallow objects', () => {
    const ref = { a: 1 };
    expect(shallowEqual(ref, ref)).toBe(true);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('is false for differing values, key counts, or non-objects', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, null)).toBe(false);
    expect(shallowEqual(null, { a: 1 })).toBe(false);
    expect(shallowEqual(5, 6)).toBe(false);
  });

  it('does not recurse (nested objects compared by reference)', () => {
    expect(shallowEqual({ a: { n: 1 } }, { a: { n: 1 } })).toBe(false);
  });
});

describe('getByPath', () => {
  const obj = { a: { b: { c: 1 } }, list: [{ x: 1 }, { x: 2 }] };

  it('returns the whole object for empty / undefined path', () => {
    expect(getByPath(obj, '')).toBe(obj);
    expect(getByPath(obj, undefined)).toBe(obj);
    expect(getByPath(obj, [])).toBe(obj);
  });

  it('reads single and deep string paths', () => {
    expect(getByPath(obj, 'a.b.c' as never)).toBe(1);
    expect(getByPath(obj, 'list.0.x' as never)).toBe(1);
  });

  it('returns undefined for missing keys and reading through a non-object', () => {
    expect(getByPath(obj, 'a.zzz' as never)).toBeUndefined();
    expect(getByPath(obj, 'a.b.c.d' as never)).toBeUndefined();
    expect(getByPath({ a: null }, 'a.b' as never)).toBeUndefined();
  });

  it('reads an array-of-keys path', () => {
    expect(getByPath(obj, ['a', 'b', 'c'] as never)).toBe(1);
    expect(getByPath(obj, ['a', 'missing'] as never)).toBeUndefined();
  });
});

describe('setByPath', () => {
  it('returns the value for an empty / non-array path', () => {
    expect(setByPath({ a: 1 }, '', 9)).toBe(9);
    expect(setByPath({ a: 1 }, [] as never, 9)).toBe(9);
  });

  it('writes single and deep paths immutably', () => {
    const obj = { a: { b: 1 }, keep: { x: 1 } };
    const next = setByPath(obj, 'a.b', 2);

    expect(next.a.b).toBe(2);
    expect(obj.a.b).toBe(1);
    expect(next.keep).toBe(obj.keep);
  });

  it('coerces numeric segments and preserves arrays via an array-of-keys path', () => {
    const obj = { list: [10, 20, 30] };
    const next = setByPath(obj, ['list', 1] as never, 99);

    expect(Array.isArray(next.list)).toBe(true);
    expect(next.list).toEqual([10, 99, 30]);
  });

  it('creates missing intermediates', () => {
    expect(setByPath({}, 'a.b.c', 7)).toEqual({ a: { b: { c: 7 } } });
  });
});

describe('isPathAffected', () => {
  it('treats a non-string (full-state) change as affecting everything', () => {
    expect(isPathAffected(undefined, 'anything')).toBe(true);
  });

  it('matches exact, ancestor and descendant relationships', () => {
    expect(isPathAffected('a.b', 'a.b')).toBe(true);
    expect(isPathAffected('a.b.c', 'a.b')).toBe(true); // descendant change affects ancestor candidate
    expect(isPathAffected('a', 'a.b')).toBe(true); // ancestor change affects descendant candidate
  });

  it('is false for siblings and partial-name collisions', () => {
    expect(isPathAffected('a.b', 'a.c')).toBe(false);
    expect(isPathAffected('user', 'username')).toBe(false);
  });
});

describe('parsePath', () => {
  it('splits on dots and caches by reference', () => {
    expect(parsePath('a.b.c')).toEqual(['a', 'b', 'c']);
    expect(parsePath('a.b.c')).toBe(parsePath('a.b.c'));
  });
});
