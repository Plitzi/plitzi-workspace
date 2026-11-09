import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { cloneAtPath, cloneDeep } from './cloneDeep';

describe('cloneDeep', () => {
  describe('cloneDeep.cloneAtPath', () => {
    it('clones only the branch at given path (object path)', () => {
      const obj = {
        a: { b: { c: 1 } },
        d: { e: 2 }
      };

      const cloned = cloneAtPath(obj, 'a.b');

      // root must be new reference
      expect(cloned).not.toBe(obj);

      // cloned branch must be new
      expect(cloned.a).not.toBe(obj.a);
      expect(cloned.a.b).not.toBe(obj.a.b);

      // untouched branch must keep reference
      expect(cloned.d).toBe(obj.d);

      // values preserved
      expect(cloned.a.b.c).toBe(1);
    });

    it('works with array path', () => {
      const obj = {
        a: { b: { c: 1 } }
      };

      const cloned = cloneAtPath(obj, ['a', 'b']);

      expect(cloned.a).not.toBe(obj.a);
      expect(cloned.a.b).not.toBe(obj.a.b);
      expect(cloned.a.b.c).toBe(1);
    });

    it('clones nested arrays correctly', () => {
      const obj = {
        items: [
          { id: 1, value: { x: 10 } },
          { id: 2, value: { x: 20 } }
        ]
      };

      const cloned = cloneAtPath(obj, ['items', 1, 'value']);

      expect(cloned).not.toBe(obj);
      expect(cloned.items).not.toBe(obj.items);
      expect(cloned.items[1]).not.toBe(obj.items[1]);
      expect(cloned.items[1].value).not.toBe(obj.items[1].value);

      // untouched index keeps reference
      expect(cloned.items[0]).toBe(obj.items[0]);

      expect(cloned.items[1].value.x).toBe(20);
    });

    it('does not mutate original object', () => {
      const obj = {
        a: { b: { c: 1 } }
      };

      const cloned = cloneAtPath(obj, 'a.b');

      cloned.a.b.c = 999;

      expect(obj.a.b.c).toBe(1);
    });

    it('returns new root even if path does not exist', () => {
      const obj = { a: 1 };

      const cloned = cloneAtPath(obj, 'x.y.z');

      expect(cloned).not.toBe(obj);
      expect(cloned).toEqual(obj);
    });

    it('handles empty path by returning shallow clone', () => {
      const obj = { a: { b: 1 } };

      const cloned = cloneAtPath(obj, []);

      expect(cloned).not.toBe(obj);
      expect(cloned.a).toBe(obj.a); // shallow clone only
    });

    it('works with numeric keys in string path', () => {
      const obj = {
        list: [{ value: 1 }, { value: 2 }]
      };

      const cloned = cloneAtPath(obj, 'list.1');

      expect(cloned.list).not.toBe(obj.list);
      expect(cloned.list[1]).not.toBe(obj.list[1]);
      expect(cloned.list[0]).toBe(obj.list[0]);
    });

    it('preserves prototype of cloned branch', () => {
      const proto = {
        greet() {
          return 'hi';
        }
      };

      const obj = Object.create(proto) as { a: { b: number } };
      obj.a = { b: 1 };

      const cloned = cloneAtPath(obj, 'a');

      expect(Object.getPrototypeOf(cloned)).toBe(proto);
      expect(cloned.a).not.toBe(obj.a);
      expect(cloned.a.b).toBe(1);
    });
  });

  it('clones primitives', () => {
    expect(cloneDeep(42)).toBe(42);
    expect(cloneDeep('hello')).toBe('hello');
    expect(cloneDeep(true)).toBe(true);
    expect(cloneDeep(null)).toBeNull();
    expect(cloneDeep(undefined)).toBeUndefined();
  });

  it('clones arrays deeply', () => {
    const arr = [1, { a: 2 }, [3, 4]];
    const cloned = cloneDeep(arr);
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[1]).not.toBe(arr[1]);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  it('clones objects deeply', () => {
    const obj = { a: 1, b: { c: 2, d: [3, 4] } };
    const cloned = cloneDeep(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
    expect(cloned.b.d).not.toBe(obj.b.d);
  });

  it('clones Map and Set', () => {
    const map = new Map<string, number | { c: number }>([
      ['a', 1],
      ['b', { c: 2 }]
    ]);
    const set = new Set<number | { d: number }>([1, 2, { d: 3 }]);
    const clonedMap = cloneDeep(map);
    const clonedSet = cloneDeep(set);

    expect(clonedMap).toEqual(map);
    expect(clonedSet).toEqual(set);

    // Ensure deep clone
    expect(clonedMap.get('b')).not.toBe(map.get('b'));
    const originalObj = [...set].find(v => typeof v === 'object');
    const clonedObj = [...clonedSet].find(v => typeof v === 'object');
    expect(clonedObj).not.toBe(originalObj);
  });

  it('clones Date and RegExp', () => {
    const date = new Date();
    const regex = /abc/gi;

    const clonedDate = cloneDeep(date);
    const clonedRegex = cloneDeep(regex);

    expect(clonedDate).toEqual(date);
    expect(clonedDate).not.toBe(date);

    expect(clonedRegex).toEqual(regex);
    expect(clonedRegex).not.toBe(regex);
  });

  it('handles cyclic references', () => {
    const obj = { a: 1 } as { a: number; self?: typeof obj };
    obj.self = obj;

    const cloned = cloneDeep(obj);
    expect(cloned.a).toBe(1);
    expect(cloned.self).toBe(cloned);
  });

  it('matches lodash.cloneDeep for complex structures', () => {
    const complex = {
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
      meta: null,
      tags: new Set([1, 2, 3]),
      map: new Map([['x', { y: 2 }]])
    };

    const cloned = cloneDeep(complex);
    const lodashCloned = _.cloneDeep(complex);

    expect(cloned).toEqual(lodashCloned);

    // Ensure deep cloning, not just shallow copy
    expect(cloned.user).not.toBe(complex.user);
    expect(cloned.items).not.toBe(complex.items);
    expect([...cloned.tags][2]).toBe([...complex.tags][2]);
    expect(cloned.map.get('x')).not.toBe(complex.map.get('x'));
  });

  it('does not mutate the original object', () => {
    const original: {
      user: { name: string; credentials: { password: string } };
      list: { id: number; value: string }[];
      meta: null | string;
    } = {
      user: {
        name: 'alice',
        credentials: { password: '1234' }
      },
      list: [{ id: 1, value: 'a' }],
      meta: null
    };

    const cloned = cloneDeep(original);

    // Modificar el clon
    cloned.user.name = 'bob';
    cloned.user.credentials.password = '4321';
    cloned.list[0].value = 'b';
    cloned.meta = 'something';

    // El original no debe cambiar
    expect(original.user.name).toBe('alice');
    expect(original.user.credentials.password).toBe('1234');
    expect(original.list[0].value).toBe('a');
    expect(original.meta).toBeNull();
  });

  it('clones functions as-is', () => {
    const fn: () => number = () => 42;
    const obj: { fn: () => number } = { fn };
    const cloned = cloneDeep(obj);
    expect(cloned.fn).toBe(fn);
  });

  it('clones symbols as-is', () => {
    const sym = Symbol('test');
    const obj: { sym: symbol } = { sym };
    const cloned = cloneDeep(obj);
    expect(cloned.sym).toBe(sym);
  });

  it('clones objects with prototype', () => {
    const proto = {
      greet(): string {
        return 'hi';
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const obj: { a: number } & typeof proto = Object.create(proto);
    obj.a = 1;
    const cloned = cloneDeep(obj);
    expect(cloned.a).toBe(1);
    expect(Object.getPrototypeOf(cloned)).toBe(proto);
    expect(cloned.greet()).toBe('hi');
  });

  it('clones nested Map and Set', () => {
    const innerMap: Map<string, number> = new Map([['x', 1]]);
    const map: Map<string, Map<string, number>> = new Map([['outer', innerMap]]);

    const cloned = cloneDeep(map);
    expect(cloned).not.toBe(map);
    expect(cloned.get('outer')).not.toBe(innerMap);
    expect(cloned.get('outer')?.get('x')).toBe(1);
  });

  it('clones typed arrays and buffers', () => {
    const arr: Uint8Array = new Uint8Array([1, 2, 3]);
    const buffer: ArrayBuffer = new ArrayBuffer(8);
    const clonedArr: Uint8Array = cloneDeep(arr);
    const clonedBuffer: ArrayBuffer = cloneDeep(buffer);
    expect(clonedArr).toEqual(arr);
    expect(clonedArr).not.toBe(arr);
    expect(clonedBuffer.byteLength).toBe(buffer.byteLength);
    expect(clonedBuffer).not.toBe(buffer);
  });

  it('handles mixed primitive, array, object structure', () => {
    type Complex = {
      num: number;
      str: string;
      arr: (number | { a: number } | number[])[];
      nested: { a: { b: number } };
      map: Map<string, { val: number }>;
      set: Set<number>;
    };

    const complex: Complex = {
      num: 1,
      str: 'hello',
      arr: [1, { a: 2 }, [3, 4]],
      nested: { a: { b: 2 } },
      map: new Map([['key', { val: 1 }]]),
      set: new Set([1, 2])
    };
    const cloned: Complex = cloneDeep(complex);
    expect(cloned).toEqual(complex);
    expect(cloned.arr).not.toBe(complex.arr);
    expect(cloned.nested.a).not.toBe(complex.nested.a);
    expect(cloned.map.get('key')).not.toBe(complex.map.get('key'));
  });

  it('handles complex nested structures with arrays, maps, sets, symbols, dates, regex', () => {
    const sym = Symbol('id');
    const complex = {
      a: 1,
      b: [2, { x: 3, y: [4, 5] }],
      c: {
        d: new Map([['key1', { val: 10 }]]),
        e: new Set([1, 2, 3]),
        f: new Date(2026, 1, 24),
        g: /test/gi,
        h: sym
      },
      i: [{ j: { k: 7 } }, { l: [{ m: 8 }] }]
    };

    const cloned = cloneDeep(complex);

    // Deep equality
    expect(cloned).toEqual(complex);

    // Nested objects and arrays are cloned
    expect(cloned.b).not.toBe(complex.b);
    // Type guard for b[1]
    const clonedB1 = cloned.b[1];
    const originalB1 = complex.b[1];
    if (typeof clonedB1 !== 'number' && typeof originalB1 !== 'number') {
      expect(clonedB1).not.toBe(originalB1);
      expect(clonedB1.y).not.toBe(originalB1.y);
    }

    // Map and Set are cloned
    expect(cloned.c.d).not.toBe(complex.c.d);
    expect(cloned.c.e).not.toBe(complex.c.e);

    // Date and RegExp cloned
    expect(cloned.c.f).not.toBe(complex.c.f);
    expect(cloned.c.f.getTime()).toBe(complex.c.f.getTime());
    expect(cloned.c.g).not.toBe(complex.c.g);
    expect(cloned.c.g.source).toBe(complex.c.g.source);
    expect(cloned.c.g.flags).toBe(complex.c.g.flags);

    // Symbol remains the same
    expect(cloned.c.h).toBe(sym);

    // Nested deep arrays in objects
    expect(cloned.i[0].j).not.toBe(complex.i[0].j);
    // Replace the last line in 'handles complex nested structures' test with a type-safe check
    const nestedSecond = cloned.i[1].l?.[0];
    const originalSecond = complex.i[1].l?.[0];
    if (nestedSecond && originalSecond) {
      expect(nestedSecond).not.toBe(originalSecond);
    }
  });

  test('stress test: cloneDeep works on large object and array', () => {
    const bigArr = Array.from({ length: 10000 }, (_, i) => ({ val: i, arr: [i, i + 1] }));
    const bigObj: Record<string, { value: number; arr: number[] }> = {};
    for (let i = 0; i < 10000; i++) {
      bigObj[`key${i}`] = { value: i, arr: [i, i + 1] };
    }
    const clonedArr = cloneDeep(bigArr);
    const clonedObj = cloneDeep(bigObj);
    expect(clonedArr).toEqual(bigArr);
    expect(clonedObj).toEqual(bigObj);
    expect(clonedArr[5000]).not.toBe(bigArr[5000]);
    expect(clonedObj['key9999']).not.toBe(bigObj['key9999']);
    expect(Array.isArray(clonedArr)).toBe(true);
    expect(typeof clonedObj).toBe('object');
  }, 5000);
});
