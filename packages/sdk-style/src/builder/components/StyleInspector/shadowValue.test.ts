import { describe, expect, it } from 'vitest';

import { parseShadow, serializeShadow } from './shadowValue';

describe('parseShadow', () => {
  it('reads the four lengths and the color', () => {
    expect(parseShadow('1px 2px 3px 4px black')).toEqual({
      inset: false,
      x: '1px',
      y: '2px',
      blur: '3px',
      spread: '4px',
      color: 'black'
    });
  });

  it('reads a shadow with only the offsets and the color', () => {
    expect(parseShadow('0 1px #000')).toMatchObject({ x: '0', y: '1px', blur: '0px', spread: '0px', color: '#000' });
  });

  it('reads inset and the color on either end', () => {
    expect(parseShadow('rgba(0, 0, 0, 0.5) 0 4px 8px inset')).toMatchObject({
      inset: true,
      color: 'rgba(0, 0, 0, 0.5)',
      blur: '8px'
    });
  });

  it('defaults the color to currentColor, as CSS does', () => {
    expect(parseShadow('2px 2px')?.color).toBe('currentColor');
  });

  it('reads a token as the color once the offsets are complete', () => {
    expect(parseShadow('0 2px 6px var(--shadow-color)')?.color).toBe('var(--shadow-color)');
  });

  it('answers undefined for what is not one shadow', () => {
    expect(parseShadow('var(--shadow-lg)')).toBeUndefined();
    expect(parseShadow('none')).toBeUndefined();
    expect(parseShadow('1px 2px 3px 4px 5px black')).toBeUndefined();
  });
});

describe('serializeShadow', () => {
  it('writes a box shadow with its spread and inset', () => {
    const shadow = { inset: true, x: '0', y: '1px', blur: '2px', spread: '0px', color: 'red' };

    expect(serializeShadow(shadow, { withSpread: true })).toBe('inset 0 1px 2px 0px red');
  });

  it('writes a text shadow without them', () => {
    const shadow = { inset: true, x: '1px', y: '1px', blur: '0px', spread: '9px', color: 'red' };

    expect(serializeShadow(shadow, { withSpread: false })).toBe('1px 1px 0px red');
  });

  it('round-trips what it reads', () => {
    const value = 'inset 0 4px 8px 0 rgba(0, 0, 0, 0.5)';
    const shadow = parseShadow(value);

    expect(shadow && serializeShadow(shadow, { withSpread: true })).toBe(value);
  });
});
