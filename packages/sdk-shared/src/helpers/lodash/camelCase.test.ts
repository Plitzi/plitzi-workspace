import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { camelCase } from './camelCase';

describe('camelCase', () => {
  it('converts strings to camelCase', () => {
    expect(camelCase('hello_world')).toBe('helloWorld');
    expect(camelCase('Hello-World')).toBe('helloWorld');
    expect(camelCase('foo bar baz')).toBe('fooBarBaz');
  });

  it('handles null, undefined and empty string', () => {
    expect(camelCase(null as unknown as string)).toBe('');
    expect(camelCase(undefined as unknown as string)).toBe('');
    expect(camelCase('')).toBe('');
  });

  it('behaves the same as lodash', () => {
    const values = ['hello_world', 'Hello-World', 'foo bar baz', '', 'A', '1abc'];
    for (const v of values) {
      expect(camelCase(v)).toBe(_.camelCase(v));
    }
  });

  test('stress test: camelCase works on large array of strings', () => {
    const arr = Array.from({ length: 10000 }, (_, i) => `foo_bar_${i}`);
    const result = arr.map(camelCase);
    expect(result[0]).toBe('fooBar0');
    expect(result[9999]).toBe('fooBar9999');
    expect(Array.isArray(result)).toBe(true);
  }, 5000);
});
