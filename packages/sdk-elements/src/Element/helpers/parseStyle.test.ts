import { describe, it, expect } from 'vitest';

import parseStyle from './parseStyle';

describe('parseStyle', () => {
  it('returns undefined for an empty or missing value', () => {
    expect(parseStyle()).toBeUndefined();
    expect(parseStyle('')).toBeUndefined();
  });

  it('passes an object style through untouched', () => {
    const style = { color: 'red', fontSize: 12 };

    expect(parseStyle(style)).toBe(style);
  });

  it('parses a CSS string into a camelCased style object', () => {
    expect(parseStyle('color: red; font-size: 12px')).toEqual({ color: 'red', fontSize: '12px' });
  });

  it('converts kebab-case properties to camelCase', () => {
    expect(parseStyle('background-color: blue; border-top-width: 1px')).toEqual({
      backgroundColor: 'blue',
      borderTopWidth: '1px'
    });
  });

  it('ignores empty segments and trailing semicolons', () => {
    expect(parseStyle('color: red;;')).toEqual({ color: 'red' });
  });
});
