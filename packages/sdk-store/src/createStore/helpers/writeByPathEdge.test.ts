import { afterEach, describe, it, expect } from 'vitest';

import { __setCodegenEnabled, UNCHANGED, writeByPath } from './writeByPath';
import parsePath from '../../helpers/parsePath';

// The writer has two interchangeable backends — a `new Function` codegen and a recursive fallback. The contract is
// that they are INDISTINGUISHABLE. These run both against the same inputs and assert identical output, plus the
// invariants (immutability, structural sharing, array preservation) that are easy to break when touching the writer.

const writeWith = (enabled: boolean, root: unknown, path: string, value: unknown, isFn: boolean) => {
  __setCodegenEnabled(enabled);

  return writeByPath(root, path, parsePath(path), value, isFn);
};

// Runs both backends and asserts they agree; returns the (structurally shared) result for further assertions.
const writeBoth = (root: unknown, path: string, value: unknown, isFn = false): unknown => {
  const viaCodegen = writeWith(true, root, path, value, isFn);
  const viaRecursive = writeWith(false, root, path, value, isFn);

  if (viaCodegen === UNCHANGED || viaRecursive === UNCHANGED) {
    expect(viaCodegen).toBe(UNCHANGED);
    expect(viaRecursive).toBe(UNCHANGED);

    return UNCHANGED;
  }

  expect(viaCodegen).toEqual(viaRecursive);

  return viaCodegen;
};

afterEach(() => __setCodegenEnabled(undefined));

describe('writeByPath — codegen and recursive agree', () => {
  const paths = ['a', 'a.b', 'a.b.c', 'a.b.c.d.e', 'user.profile.name', 'x.y', 'deep.one.two.three.four.five'];

  it('produces identical output for every shape', () => {
    const root = {
      a: { b: { c: 1 }, sibling: 1 },
      user: { profile: { name: 'Ada', age: 36 } },
      x: { y: 2 },
      deep: { one: { two: { three: { four: { five: 0 } } } } },
      untouched: { kept: true }
    };

    for (const path of paths) {
      const result = writeBoth(root, path, 'NEW') as Record<string, unknown>;
      expect(result).not.toBe(root);
      expect(result.untouched).toBe(root.untouched); // unrelated subtree shared
    }
  });

  it('agrees on UNCHANGED when the leaf value is identical', () => {
    expect(writeBoth({ a: { b: 5 } }, 'a.b', 5)).toBe(UNCHANGED);
    expect(writeBoth({ a: { b: { c: 'x' } } }, 'a.b.c', 'x')).toBe(UNCHANGED);
  });

  it('agrees on updater functions', () => {
    const result = writeBoth({ a: { b: 10 } }, 'a.b', (p: number) => p + 1, true) as { a: { b: number } };
    expect(result.a.b).toBe(11);
  });

  it('agrees when creating missing intermediates from scratch', () => {
    expect(writeBoth({}, 'a.b.c.d', 7)).toEqual({ a: { b: { c: { d: 7 } } } });
  });

  it('agrees on non-identifier / special-character segments', () => {
    expect(writeBoth({}, 'flat.weird key', 1)).toEqual({ flat: { 'weird key': 1 } });
    expect(writeBoth({}, 'flat.a-b', 1)).toEqual({ flat: { 'a-b': 1 } });
    expect(writeBoth({}, 'flat.a"]; evil(); //', 1)).toEqual({ flat: { 'a"]; evil(); //': 1 } });
  });

  it('does not mutate the input on either backend', () => {
    const root = { a: { b: { c: 1 } } };
    writeWith(true, root, 'a.b.c', 99, false);
    writeWith(false, root, 'a.b.c', 99, false);
    expect(root.a.b.c).toBe(1);
  });
});

describe('writeByPath — array preservation', () => {
  it('keeps a top-level array an array on an indexed write', () => {
    const result = writeBoth({ list: [10, 20, 30] }, 'list.1', 99) as { list: number[] };
    expect(Array.isArray(result.list)).toBe(true);
    expect(result.list).toEqual([10, 99, 30]);
  });

  it('keeps nested arrays and array-of-objects intact', () => {
    const root = { rows: [{ cells: [1, 2] }, { cells: [3, 4] }] };
    const result = writeBoth(root, 'rows.1.cells.0', 99) as typeof root;

    expect(Array.isArray(result.rows)).toBe(true);
    expect(Array.isArray(result.rows[1].cells)).toBe(true);
    expect(result.rows[1].cells).toEqual([99, 4]);
    expect(result.rows[0]).toBe(root.rows[0]); // untouched row shared
  });

  it('resolves an updater against an array element', () => {
    const result = writeBoth({ list: [1, 2, 3] }, 'list.2', (n: number) => n * 10, true) as { list: number[] };
    expect(result.list).toEqual([1, 2, 30]);
  });

  it('preserves the array when writing a deep leaf inside an element', () => {
    const root = { items: [{ meta: { n: 1 } }] };
    const result = writeBoth(root, 'items.0.meta.n', 5) as typeof root;
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0].meta.n).toBe(5);
  });
});

describe('writeByPath — differential fuzz (codegen vs recursive)', () => {
  it('agrees across many randomly generated object paths', () => {
    // Deterministic LCG so a failure reproduces.
    let seed = 123456789;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      return seed % max;
    };

    const keys = ['a', 'b', 'c', 'x', 'y', 'z'];
    const randomRoot = (): Record<string, unknown> => ({
      a: { b: { c: rand(10) }, x: rand(10) },
      b: { y: { z: rand(10) } },
      c: rand(10),
      x: { a: { b: rand(10) } }
    });

    for (let iteration = 0; iteration < 200; iteration++) {
      const depth = 1 + rand(4);
      const path = Array.from({ length: depth }, () => keys[rand(keys.length)]).join('.');
      const root = randomRoot();
      const value = rand(2) === 0 ? rand(1000) : { nested: rand(1000) };

      const viaCodegen = writeWith(true, root, path, value, false);
      const viaRecursive = writeWith(false, root, path, value, false);

      if (viaCodegen === UNCHANGED || viaRecursive === UNCHANGED) {
        expect(viaCodegen).toBe(viaRecursive);
      } else {
        expect(viaCodegen).toEqual(viaRecursive);
      }
    }
  });
});
