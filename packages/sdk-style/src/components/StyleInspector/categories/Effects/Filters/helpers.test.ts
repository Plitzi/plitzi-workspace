import { describe, expect, it } from 'vitest';

import { parseFilter, serializeFilter } from './helpers';

describe('parseFilter', () => {
  it('reads a filter function and its argument', () => {
    expect(parseFilter('blur(4px)')).toEqual({ name: 'blur', amount: '4px' });
    expect(parseFilter('hue-rotate(90deg)')).toEqual({ name: 'hue-rotate', amount: '90deg' });
  });

  it('keeps a percentage argument as written', () => {
    expect(parseFilter('brightness(120%)')).toEqual({ name: 'brightness', amount: '120%' });
  });

  it('answers undefined for the functions it has no control for', () => {
    expect(parseFilter('drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))')).toBeUndefined();
    expect(parseFilter('url(#noise)')).toBeUndefined();
    expect(parseFilter('var(--glass)')).toBeUndefined();
  });

  it('round-trips what it reads', () => {
    expect(serializeFilter({ name: 'opacity', amount: '0.5' })).toBe('opacity(0.5)');
  });
});
