import { describe, expect, it } from 'vitest';

import { expandShorthand } from './index';

describe('expandShorthand', () => {
  describe('padding', () => {
    it('expands single value to all sides', () => {
      const result = expandShorthand({ padding: '8px' });
      expect(result).toEqual({
        'padding-top': '8px',
        'padding-right': '8px',
        'padding-bottom': '8px',
        'padding-left': '8px'
      });
    });

    it('expands two values to vertical and horizontal', () => {
      const result = expandShorthand({ padding: '10px 20px' });
      expect(result).toEqual({
        'padding-top': '10px',
        'padding-right': '20px',
        'padding-bottom': '10px',
        'padding-left': '20px'
      });
    });

    it('expands three values to top, horizontal, bottom', () => {
      const result = expandShorthand({ padding: '4px 8px 12px' });
      expect(result).toEqual({
        'padding-top': '4px',
        'padding-right': '8px',
        'padding-bottom': '12px',
        'padding-left': '8px'
      });
    });

    it('expands four values to all sides individually', () => {
      const result = expandShorthand({ padding: '1px 2px 3px 4px' });
      expect(result).toEqual({
        'padding-top': '1px',
        'padding-right': '2px',
        'padding-bottom': '3px',
        'padding-left': '4px'
      });
    });
  });
  describe('margin', () => {
    it('expands single value to all sides', () => {
      const result = expandShorthand({ margin: '0' });
      expect(result).toEqual({ 'margin-top': '0', 'margin-right': '0', 'margin-bottom': '0', 'margin-left': '0' });
    });

    it('expands two values to vertical and horizontal', () => {
      const result = expandShorthand({ margin: '0 auto' });
      expect(result).toEqual({
        'margin-top': '0',
        'margin-right': 'auto',
        'margin-bottom': '0',
        'margin-left': 'auto'
      });
    });

    it('expands three values to top, horizontal, bottom', () => {
      const result = expandShorthand({ margin: '10px 20px 30px' });
      expect(result).toEqual({
        'margin-top': '10px',
        'margin-right': '20px',
        'margin-bottom': '30px',
        'margin-left': '20px'
      });
    });

    it('expands four values to all sides individually', () => {
      const result = expandShorthand({ margin: '1px 2px 3px 4px' });
      expect(result).toEqual({
        'margin-top': '1px',
        'margin-right': '2px',
        'margin-bottom': '3px',
        'margin-left': '4px'
      });
    });
  });
  describe('inset', () => {
    it('expands single value to all sides', () => {
      const result = expandShorthand({ inset: '10px' });
      expect(result).toEqual({ top: '10px', right: '10px', bottom: '10px', left: '10px' });
    });

    it('expands two values to vertical and horizontal', () => {
      const result = expandShorthand({ inset: '10px 20px' });
      expect(result).toEqual({ top: '10px', right: '20px', bottom: '10px', left: '20px' });
    });

    it('expands three values to top, horizontal, bottom', () => {
      const result = expandShorthand({ inset: '1px 2px 3px' });
      expect(result).toEqual({ top: '1px', right: '2px', bottom: '3px', left: '2px' });
    });

    it('expands four values to all sides individually', () => {
      const result = expandShorthand({ inset: '1px 2px 3px 4px' });
      expect(result).toEqual({ top: '1px', right: '2px', bottom: '3px', left: '4px' });
    });
  });
  describe('border-radius', () => {
    it('expands single value to all corners', () => {
      const result = expandShorthand({ 'border-radius': '8px' });
      expect(result).toEqual({
        'border-top-left-radius': '8px',
        'border-top-right-radius': '8px',
        'border-bottom-right-radius': '8px',
        'border-bottom-left-radius': '8px'
      });
    });

    it('expands two values to diagonal pairs', () => {
      const result = expandShorthand({ 'border-radius': '4px 8px' });
      expect(result).toEqual({
        'border-top-left-radius': '4px',
        'border-top-right-radius': '8px',
        'border-bottom-right-radius': '4px',
        'border-bottom-left-radius': '8px'
      });
    });

    it('expands three values to tl, tr+bl, br', () => {
      const result = expandShorthand({ 'border-radius': '1px 2px 3px' });
      expect(result).toEqual({
        'border-top-left-radius': '1px',
        'border-top-right-radius': '2px',
        'border-bottom-right-radius': '3px',
        'border-bottom-left-radius': '2px'
      });
    });

    it('expands four values to each corner', () => {
      const result = expandShorthand({ 'border-radius': '1px 2px 3px 4px' });
      expect(result).toEqual({
        'border-top-left-radius': '1px',
        'border-top-right-radius': '2px',
        'border-bottom-right-radius': '3px',
        'border-bottom-left-radius': '4px'
      });
    });
  });
  describe('gap', () => {
    it('expands single value to both axes', () => {
      const result = expandShorthand({ gap: '16px' });
      expect(result).toEqual({ 'row-gap': '16px', 'column-gap': '16px' });
    });

    it('expands two values to row and column', () => {
      const result = expandShorthand({ gap: '10px 20px' });
      expect(result).toEqual({ 'row-gap': '10px', 'column-gap': '20px' });
    });
  });
  describe('border', () => {
    it('expands single style token to all sides', () => {
      const result = expandShorthand({ border: 'solid' });
      expect(result).toHaveProperty('border-top-style', 'solid');
      expect(result).toHaveProperty('border-right-style', 'solid');
      expect(result).toHaveProperty('border-bottom-style', 'solid');
      expect(result).toHaveProperty('border-left-style', 'solid');
    });

    it('expands single color token to all sides', () => {
      const result = expandShorthand({ border: 'red' });
      expect(result).toHaveProperty('border-top-color', 'red');
      expect(result).toHaveProperty('border-right-color', 'red');
      expect(result).toHaveProperty('border-bottom-color', 'red');
      expect(result).toHaveProperty('border-left-color', 'red');
    });

    it('expands two tokens (width + style) to all sides', () => {
      const result = expandShorthand({ border: '2px dashed' });
      expect(result).toHaveProperty('border-top-width', '2px');
      expect(result).toHaveProperty('border-top-style', 'dashed');
      expect(result).toHaveProperty('border-right-width', '2px');
      expect(result).toHaveProperty('border-right-style', 'dashed');
    });

    it('expands three tokens (width + style + color) to all sides', () => {
      const result = expandShorthand({ border: '1px solid red' });
      expect(result).toHaveProperty('border-top-width', '1px');
      expect(result).toHaveProperty('border-top-style', 'solid');
      expect(result).toHaveProperty('border-top-color', 'red');
      expect(result).toHaveProperty('border-bottom-width', '1px');
      expect(result).toHaveProperty('border-bottom-color', 'red');
    });
  });
  describe('border-{side}', () => {
    it('expands border-top with style only, resetting width and color', () => {
      const result = expandShorthand({ 'border-top': 'dashed' });
      expect(result).toEqual({
        'border-top-width': 'medium',
        'border-top-style': 'dashed',
        'border-top-color': 'currentcolor'
      });
    });

    it('expands border-right with width and style', () => {
      const result = expandShorthand({ 'border-right': '2px solid' });
      expect(result).toEqual({
        'border-right-width': '2px',
        'border-right-style': 'solid',
        'border-right-color': 'currentcolor'
      });
    });

    it('expands border-bottom with all three tokens', () => {
      const result = expandShorthand({ 'border-bottom': '4px groove blue' });
      expect(result).toEqual({
        'border-bottom-width': '4px',
        'border-bottom-style': 'groove',
        'border-bottom-color': 'blue'
      });
    });

    it('expands border-left with single width', () => {
      const result = expandShorthand({ 'border-left': '3px' });
      expect(result).toEqual({
        'border-left-width': '3px',
        'border-left-style': 'none',
        'border-left-color': 'currentcolor'
      });
    });
  });
  describe('border-width', () => {
    it('single value expands to all sides', () => {
      const result = expandShorthand({ 'border-width': '2px' });
      expect(result).toEqual({
        'border-top-width': '2px',
        'border-right-width': '2px',
        'border-bottom-width': '2px',
        'border-left-width': '2px'
      });
    });

    it('two values expand to vertical / horizontal', () => {
      const result = expandShorthand({ 'border-width': '1px 3px' });
      expect(result).toEqual({
        'border-top-width': '1px',
        'border-right-width': '3px',
        'border-bottom-width': '1px',
        'border-left-width': '3px'
      });
    });

    it('three values expand with left copying right', () => {
      const result = expandShorthand({ 'border-width': '1px 2px 3px' });
      expect(result).toEqual({
        'border-top-width': '1px',
        'border-right-width': '2px',
        'border-bottom-width': '3px',
        'border-left-width': '2px'
      });
    });

    it('four values expand to each side', () => {
      const result = expandShorthand({ 'border-width': '1px 2px 3px 4px' });
      expect(result).toEqual({
        'border-top-width': '1px',
        'border-right-width': '2px',
        'border-bottom-width': '3px',
        'border-left-width': '4px'
      });
    });

    it('keyword width', () => {
      const result = expandShorthand({ 'border-width': 'thin' });
      expect(result).toEqual({
        'border-top-width': 'thin',
        'border-right-width': 'thin',
        'border-bottom-width': 'thin',
        'border-left-width': 'thin'
      });
    });
  });
  describe('border-color', () => {
    it('single value expands to all sides', () => {
      const result = expandShorthand({ 'border-color': 'red' });
      expect(result).toEqual({
        'border-top-color': 'red',
        'border-right-color': 'red',
        'border-bottom-color': 'red',
        'border-left-color': 'red'
      });
    });

    it('two values expand to vertical / horizontal', () => {
      const result = expandShorthand({ 'border-color': 'red blue' });
      expect(result).toEqual({
        'border-top-color': 'red',
        'border-right-color': 'blue',
        'border-bottom-color': 'red',
        'border-left-color': 'blue'
      });
    });

    it('four values expand to each side', () => {
      const result = expandShorthand({ 'border-color': 'red green blue yellow' });
      expect(result).toEqual({
        'border-top-color': 'red',
        'border-right-color': 'green',
        'border-bottom-color': 'blue',
        'border-left-color': 'yellow'
      });
    });

    it('hex color value', () => {
      const result = expandShorthand({ 'border-color': '#e6e2da' });
      expect(result).toEqual({
        'border-top-color': '#e6e2da',
        'border-right-color': '#e6e2da',
        'border-bottom-color': '#e6e2da',
        'border-left-color': '#e6e2da'
      });
    });
  });
  describe('border-style', () => {
    it('single value expands to all sides', () => {
      const result = expandShorthand({ 'border-style': 'solid' });
      expect(result).toEqual({
        'border-top-style': 'solid',
        'border-right-style': 'solid',
        'border-bottom-style': 'solid',
        'border-left-style': 'solid'
      });
    });

    it('two values expand to vertical / horizontal', () => {
      const result = expandShorthand({ 'border-style': 'solid dashed' });
      expect(result).toEqual({
        'border-top-style': 'solid',
        'border-right-style': 'dashed',
        'border-bottom-style': 'solid',
        'border-left-style': 'dashed'
      });
    });

    it('four values expand to each side', () => {
      const result = expandShorthand({ 'border-style': 'solid dashed double groove' });
      expect(result).toEqual({
        'border-top-style': 'solid',
        'border-right-style': 'dashed',
        'border-bottom-style': 'double',
        'border-left-style': 'groove'
      });
    });
  });
  describe('grid / grid-template', () => {
    it('expands grid with column tracks', () => {
      const result = expandShorthand({ grid: '1fr 2fr' });
      expect(result).toEqual({ 'grid-template-columns': '1fr 2fr' });
    });

    it('reads the track sizes of the areas form as ROW sizes', () => {
      const result = expandShorthand({ 'grid-template': '1fr 2fr "header"' });
      expect(result).toEqual({
        'grid-template-rows': '1fr 2fr',
        'grid-template-areas': '"header"'
      });
    });

    it('splits the `rows / columns` form on its slash', () => {
      const result = expandShorthand({ grid: '100px auto / 1fr 2fr' });
      expect(result).toEqual({
        'grid-template-rows': '100px auto',
        'grid-template-columns': '1fr 2fr'
      });
    });

    it('keeps a quoted area string whole and pairs it with its row size', () => {
      const result = expandShorthand({ 'grid-template': '"header header" 60px / 1fr 1fr' });
      expect(result).toEqual({
        'grid-template-areas': '"header header"',
        'grid-template-rows': '60px',
        'grid-template-columns': '1fr 1fr'
      });
    });

    it('handles none value', () => {
      const result = expandShorthand({ grid: 'none' });
      expect(result).toEqual({ 'grid-template-columns': 'none' });
    });
  });
  describe('explicit longhand wins over expansion', () => {
    it('keeps explicit longhand when shorthand also present', () => {
      const result = expandShorthand({
        overflow: 'hidden',
        'overflow-x': 'auto'
      });
      expect(result['overflow-x']).toBe('auto');
      expect(result['overflow-y']).toBe('hidden');
    });
  });
  describe('passes through unknown keys', () => {
    it('does not modify unknown properties', () => {
      const result = expandShorthand({ color: 'red', 'z-index': '10' });
      expect(result).toEqual({ color: 'red', 'z-index': '10' });
    });
  });
});
describe('malformed / unsupported shorthands', () => {
  describe('border-radius with /', () => {
    it('keeps both radii of the elliptical form on each corner longhand', () => {
      const result = expandShorthand({ 'border-radius': '10px / 5px' });
      expect(result).toEqual({
        'border-top-left-radius': '10px 5px',
        'border-top-right-radius': '10px 5px',
        'border-bottom-right-radius': '10px 5px',
        'border-bottom-left-radius': '10px 5px'
      });
    });

    it('pairs each corner with its own horizontal and vertical radius', () => {
      const result = expandShorthand({ 'border-radius': '10px 20px / 30px 40px' });
      expect(result).toEqual({
        'border-top-left-radius': '10px 30px',
        'border-top-right-radius': '20px 40px',
        'border-bottom-right-radius': '10px 30px',
        'border-bottom-left-radius': '20px 40px'
      });
    });
  });
  describe('unknown shorthand keys', () => {
    it('unknown shorthand key passes through unchanged', () => {
      const result = expandShorthand({ 'box-shadow': '0 2px 4px rgba(0,0,0,0.1)' });
      expect(result).toEqual({ 'box-shadow': '0 2px 4px rgba(0,0,0,0.1)' });
    });

    it('multiple unknown keys all pass through', () => {
      const result = expandShorthand({ 'clip-path': 'circle(50%)', filter: 'blur(4px)' });
      expect(result).toEqual({ 'clip-path': 'circle(50%)', filter: 'blur(4px)' });
    });
  });
  describe('empty / whitespace values', () => {
    it('empty string on padding expands to nothing', () => {
      const result = expandShorthand({ padding: '' });
      expect(result).toEqual({});
    });

    it('whitespace-only value on margin expands to nothing', () => {
      const result = expandShorthand({ margin: '   ' });
      expect(result).toEqual({});
    });

    it('empty string on border produces no longhands', () => {
      const result = expandShorthand({ border: '' });
      expect(result).toEqual({});
    });

    it('empty string on overflow expands to nothing', () => {
      const result = expandShorthand({ overflow: '' });
      expect(result).toEqual({});
    });
  });
  describe('overflow edge cases', () => {
    it('3+ tokens uses only the first two', () => {
      const result = expandShorthand({ overflow: 'hidden auto scroll' });
      expect(result).toEqual({ 'overflow-x': 'hidden', 'overflow-y': 'auto' });
    });

    it('single value duplicates to both axes', () => {
      const result = expandShorthand({ overflow: 'visible' });
      expect(result).toEqual({ 'overflow-x': 'visible', 'overflow-y': 'visible' });
    });
  });
});
