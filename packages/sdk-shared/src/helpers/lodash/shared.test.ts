import { describe, expect, test } from 'vitest';

import { toPath } from './shared';

import type { Path } from './shared';

describe('shared', () => {
  describe('toPath', () => {
    test('returns empty array for empty string', () => {
      const result = toPath('');
      expect(result).toEqual([]);
    });

    test('returns empty array for nullish-like values casted', () => {
      // Solo para robustez interna (Path no permite null)
      expect(toPath(undefined as unknown as Path)).toEqual([]);
    });

    test('parse simple', () => {
      const result = toPath('test');
      expect(result).toEqual(['test']);

      const result2 = toPath('test-1');
      expect(result2).toEqual(['test-1']);
    });

    test('parses simple dot notation', () => {
      const result = toPath('a.b.c');
      expect(result).toEqual(['a', 'b', 'c']);

      const result2 = toPath('a.1.b');
      expect(result2).toEqual(['a', '1', 'b']);
    });

    test('parses simple dot notation malformed', () => {
      const paths = ['a.b.c.', '.b.c.d', '.b.c.d', 'a..b.c', 'a...b.c', 'a....b.c', 'a.,.b.c', 'a.#.b.c'];
      for (const p of paths) {
        expect(toPath(p)).toEqual([]);
      }
    });

    test('parses bracket notation', () => {
      const result = toPath('a[0].b[1]');
      expect(result).toEqual(['a', '0', 'b', '1']);
    });

    test('parses bracket notation malformed', () => {
      const paths = ['a[0].b[]', 'a[0].b[1', 'a[0].b[][1', 'a[0].b[9][1', 'a[0].b[0]1]'];
      for (const p of paths) {
        expect(toPath(p)).toEqual([]);
      }
    });

    test('parses mixed dot and bracket notation', () => {
      const result = toPath('user.addresses[2].city');
      expect(result).toEqual(['user', 'addresses', '2', 'city']);
    });

    test('handles numeric string keys', () => {
      const result = toPath('items.0.value');
      expect(result).toEqual(['items', '0', 'value']);
    });

    test('handles consecutive brackets', () => {
      const result = toPath('a[0][1][2]');
      expect(result).toEqual(['a', '0', '1', '2']);
    });

    test('ignores empty segments gracefully', () => {
      const result = toPath('a..b...c', false);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('works with array path (string + number)', () => {
      const path: Path = ['a', 0, 'b', 2];
      const result = toPath(path);
      expect(result).toEqual(['a', '0', 'b', '2']);
    });

    test('returns new array instance when input is array', () => {
      const path: Path = ['a', 1, 'b'];
      const result = toPath(path);

      expect(result).toEqual(['a', '1', 'b']);
      expect(result).not.toBe(path);
    });

    test('does not mutate original array path', () => {
      const path: Path = ['a', 1, 'b'];
      const original = [...path];

      toPath(path);

      expect(path).toEqual(original);
    });

    test('returns consistent results across multiple calls (regex state safety)', () => {
      const p1 = toPath('a.b.c');
      const p2 = toPath('x.y.z');

      expect(p1).toEqual(['a', 'b', 'c']);
      expect(p2).toEqual(['x', 'y', 'z']);
    });

    test('stress test: handles large path string', () => {
      const bigPath = Array.from({ length: 5000 }, (_, i) => `a${i}`).join('.');
      const result = toPath(bigPath);

      expect(result.length).toBe(5000);
      expect(result[0]).toBe('a0');
      expect(result[4999]).toBe('a4999');
    });
  });
});
