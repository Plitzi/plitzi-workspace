import _ from 'lodash';
import { describe, it, expect, test } from 'vitest';

import { capitalize } from './capitalize';

describe('capitalize', () => {
  it('capitalizes string', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('lowercases rest of string', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });

  it('returns empty string for null or undefined', () => {
    expect(capitalize(null)).toBe('');
    expect(capitalize(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('');
  });

  it('behaves the same as lodash', () => {
    const values = ['hello', 'hELLO', '', 'A', '1abc'];
    for (const v of values) {
      expect(capitalize(v)).toBe(_.capitalize(v));
    }
  });

  test('stress test: capitalize works on large array of strings', () => {
    const arr = Array.from({ length: 10000 }, (_, i) => `str${i}`);
    const result = arr.map(capitalize);
    expect(result[0]).toBe('Str0');
    expect(result[9999]).toBe('Str9999');
    expect(Array.isArray(result)).toBe(true);
  }, 5000);
});
