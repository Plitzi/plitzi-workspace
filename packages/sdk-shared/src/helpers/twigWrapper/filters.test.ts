/* eslint-disable quotes */
import { expect, describe, it } from 'vitest';

import { processTwig } from '.';
import { applyFilters, filters } from './filters';

describe('twig filters — value transforms', () => {
  it('upper, lower and trim transform only strings', () => {
    expect(processTwig('{{ name | upper }}', { name: 'peter' })).toBe('PETER');
    expect(processTwig('{{ name | lower }}', { name: 'PETER' })).toBe('peter');
    expect(processTwig('{{ name | trim }}', { name: '  hi  ' })).toBe('hi');
  });

  it('capitalize uppercases the first char and lowercases the rest', () => {
    expect(processTwig('{{ name | capitalize }}', { name: 'hELLO' })).toBe('Hello');
  });

  it('length counts a string, an array and an object', () => {
    expect(processTwig('{{ v | length }}', { v: 'abcd' })).toBe('4');
    expect(processTwig('{{ v | length }}', { v: [1, 2, 3] })).toBe('3');
    expect(processTwig('{{ v | length }}', { v: { a: 1, b: 2 } })).toBe('2');
  });

  it('join concatenates an array with the given separator', () => {
    expect(processTwig('{{ v | join(", ") }}', { v: ['a', 'b', 'c'] })).toBe('a, b, c');
    expect(processTwig('{{ v | join }}', { v: ['a', 'b'] })).toBe('ab');
  });

  it('chains filters left to right', () => {
    expect(processTwig('{{ name | trim | upper }}', { name: '  hi  ' })).toBe('HI');
  });

  it('ignores an unknown filter instead of throwing', () => {
    expect(() => processTwig('{{ name | wat }}', { name: 'x' })).not.toThrow();
    expect(processTwig('{{ name | wat }}', { name: 'x' })).toBe('x');
  });

  it('leaves a non-matching value type untouched', () => {
    expect(applyFilters(5, '| upper', {})).toBe(5);
    expect(applyFilters({ a: 1 }, '| trim', {})).toEqual({ a: 1 });
  });
});

describe('twig filters — default value support', () => {
  it('substitutes the default when the value is undefined, null or empty', () => {
    expect(processTwig("{{ missing | default('x') }}", {})).toBe('x');
    expect(processTwig("{{ v | default('x') }}", { v: '' })).toBe('x');
    expect(processTwig("{{ v | default('x') }}", { v: null })).toBe('x');
  });

  it('keeps a present value, including zero and false', () => {
    expect(processTwig("{{ v | default('x') }}", { v: 'here' })).toBe('here');
    expect(processTwig("{{ v | default('x') }}", { v: 0 })).toBe('0');
    expect(processTwig("{{ v | default('x') }}", { v: false })).toBe('false');
  });

  it('accepts another path as the default', () => {
    expect(processTwig('{{ missing | default(fallback) }}', { fallback: 'from-var' })).toBe('from-var');
  });

  it('the ?? operator remains an alias for a missing default', () => {
    expect(processTwig("{{ missing ?? 'x' }}", {})).toBe('x');
    expect(processTwig("{{ v ?? 'x' }}", { v: 'here' })).toBe('here');
  });

  it('exposes the filter registry for extension', () => {
    expect(typeof filters.default).toBe('function');
    expect(typeof filters.object_as_json).toBe('function');
  });
});
