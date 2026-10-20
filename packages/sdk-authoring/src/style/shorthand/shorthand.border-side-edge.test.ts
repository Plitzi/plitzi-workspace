import { describe, expect, it } from 'vitest';

import { isCssProperty } from '../properties';
import { cssShorthands, expandShorthand, expandShorthandPatch, shorthandLonghands } from './index';

describe('malformed / unsupported shorthands', () => {
  describe('border-{side} edge cases', () => {
    it('border-top with color only', () => {
      const result = expandShorthand({ 'border-top': 'red' });
      expect(result).toEqual({
        'border-top-width': 'medium',
        'border-top-style': 'none',
        'border-top-color': 'red'
      });
    });

    it('border-right with all three', () => {
      const result = expandShorthand({ 'border-right': '3px double green' });
      expect(result).toEqual({
        'border-right-width': '3px',
        'border-right-style': 'double',
        'border-right-color': 'green'
      });
    });

    it('border-bottom with two tokens (style + color)', () => {
      const result = expandShorthand({ 'border-bottom': 'dashed blue' });
      expect(result).toEqual({
        'border-bottom-width': 'medium',
        'border-bottom-style': 'dashed',
        'border-bottom-color': 'blue'
      });
    });

    it('border-left with style only', () => {
      const result = expandShorthand({ 'border-left': 'ridge' });
      expect(result).toEqual({
        'border-left-width': 'medium',
        'border-left-style': 'ridge',
        'border-left-color': 'currentcolor'
      });
    });

    it('border-left with color only', () => {
      const result = expandShorthand({ 'border-left': 'orange' });
      expect(result).toEqual({
        'border-left-width': 'medium',
        'border-left-style': 'none',
        'border-left-color': 'orange'
      });
    });
  });
  describe('border-width edge cases', () => {
    it('more than 4 values uses only the first 4', () => {
      const result = expandShorthand({ 'border-width': '1px 2px 3px 4px 5px' });
      expect(result).toEqual({
        'border-top-width': '1px',
        'border-right-width': '2px',
        'border-bottom-width': '3px',
        'border-left-width': '4px'
      });
    });

    it('empty value expands to nothing', () => {
      const result = expandShorthand({ 'border-width': '' });
      expect(result).toEqual({});
    });
  });
  describe('border-color edge cases', () => {
    it('transparent keyword', () => {
      const result = expandShorthand({ 'border-color': 'transparent' });
      expect(result).toEqual({
        'border-top-color': 'transparent',
        'border-right-color': 'transparent',
        'border-bottom-color': 'transparent',
        'border-left-color': 'transparent'
      });
    });

    it('currentcolor keyword', () => {
      const result = expandShorthand({ 'border-color': 'currentcolor' });
      expect(result).toEqual({
        'border-top-color': 'currentcolor',
        'border-right-color': 'currentcolor',
        'border-bottom-color': 'currentcolor',
        'border-left-color': 'currentcolor'
      });
    });
  });
  describe('border-style edge cases', () => {
    it('none keyword', () => {
      const result = expandShorthand({ 'border-style': 'none' });
      expect(result).toEqual({
        'border-top-style': 'none',
        'border-right-style': 'none',
        'border-bottom-style': 'none',
        'border-left-style': 'none'
      });
    });

    it('hidden keyword', () => {
      const result = expandShorthand({ 'border-style': 'hidden' });
      expect(result).toEqual({
        'border-top-style': 'hidden',
        'border-right-style': 'hidden',
        'border-bottom-style': 'hidden',
        'border-left-style': 'hidden'
      });
    });
  });
  describe('padding/margin/inset edge cases', () => {
    it('more than 4 values uses only the first 4', () => {
      const result = expandShorthand({ padding: '1px 2px 3px 4px 5px' });
      expect(result).toEqual({
        'padding-top': '1px',
        'padding-right': '2px',
        'padding-bottom': '3px',
        'padding-left': '4px'
      });
    });

    it('auto value on margin', () => {
      const result = expandShorthand({ margin: 'auto' });
      expect(result).toEqual({
        'margin-top': 'auto',
        'margin-right': 'auto',
        'margin-bottom': 'auto',
        'margin-left': 'auto'
      });
    });

    it('mixed auto and length on margin', () => {
      const result = expandShorthand({ margin: '0 auto 0 auto' });
      expect(result).toEqual({
        'margin-top': '0',
        'margin-right': 'auto',
        'margin-bottom': '0',
        'margin-left': 'auto'
      });
    });

    it('negative values on inset', () => {
      const result = expandShorthand({ inset: '-10px' });
      expect(result).toEqual({ top: '-10px', right: '-10px', bottom: '-10px', left: '-10px' });
    });

    it('percentage values on inset', () => {
      const result = expandShorthand({ inset: '0 10%' });
      expect(result).toEqual({ top: '0', right: '10%', bottom: '0', left: '10%' });
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

    it('explicit padding-left wins over padding shorthand', () => {
      const result = expandShorthand({
        padding: '10px',
        'padding-left': '0'
      });
      expect(result['padding-top']).toBe('10px');
      expect(result['padding-left']).toBe('0');
    });

    it('explicit border-top-color wins over border shorthand', () => {
      const result = expandShorthand({
        border: '1px solid blue',
        'border-top-color': 'red'
      });
      expect(result['border-top-color']).toBe('red');
      expect(result['border-top-style']).toBe('solid');
      expect(result['border-bottom-color']).toBe('blue');
    });
  });
  describe('passes through unknown keys', () => {
    it('does not modify unknown properties', () => {
      const result = expandShorthand({ color: 'red', 'z-index': '10' });
      expect(result).toEqual({ color: 'red', 'z-index': '10' });
    });
  });
});
describe('isCssProperty', () => {
  it('returns true for standard properties', () => {
    expect(isCssProperty('display')).toBe(true);
    expect(isCssProperty('overflow')).toBe(true);
    expect(isCssProperty('font-size')).toBe(true);
  });

  it('returns true for newly added longhands', () => {
    expect(isCssProperty('overflow-x')).toBe(true);
    expect(isCssProperty('overflow-y')).toBe(true);
    expect(isCssProperty('text-decoration-line')).toBe(true);
    expect(isCssProperty('text-decoration-color')).toBe(true);
    expect(isCssProperty('text-decoration-style')).toBe(true);
    expect(isCssProperty('outline-width')).toBe(true);
    expect(isCssProperty('outline-style')).toBe(true);
    expect(isCssProperty('outline-color')).toBe(true);
    expect(isCssProperty('transition-property')).toBe(true);
    expect(isCssProperty('transition-duration')).toBe(true);
    expect(isCssProperty('transition-timing-function')).toBe(true);
    expect(isCssProperty('transition-delay')).toBe(true);
    expect(isCssProperty('animation-name')).toBe(true);
    expect(isCssProperty('animation-duration')).toBe(true);
    expect(isCssProperty('animation-timing-function')).toBe(true);
    expect(isCssProperty('animation-delay')).toBe(true);
    expect(isCssProperty('animation-iteration-count')).toBe(true);
    expect(isCssProperty('column-width')).toBe(true);
    expect(isCssProperty('column-count')).toBe(true);
    expect(isCssProperty('justify-items')).toBe(true);
    expect(isCssProperty('justify-self')).toBe(true);
    expect(isCssProperty('justify-content')).toBe(true);
    expect(isCssProperty('align-self')).toBe(true);
    expect(isCssProperty('align-content')).toBe(true);
    expect(isCssProperty('flex-grow')).toBe(true);
    expect(isCssProperty('flex-shrink')).toBe(true);
    expect(isCssProperty('flex-basis')).toBe(true);
    expect(isCssProperty('flex-direction')).toBe(true);
    expect(isCssProperty('flex-wrap')).toBe(true);
    expect(isCssProperty('font-variant')).toBe(true);
    expect(isCssProperty('grid-row-start')).toBe(true);
    expect(isCssProperty('grid-row-end')).toBe(true);
    expect(isCssProperty('grid-column-start')).toBe(true);
    expect(isCssProperty('grid-column-end')).toBe(true);
    expect(isCssProperty('list-style-type')).toBe(true);
    expect(isCssProperty('list-style-position')).toBe(true);
    expect(isCssProperty('list-style-image')).toBe(true);
    expect(isCssProperty('background-color')).toBe(true);
    expect(isCssProperty('background-image')).toBe(true);
    expect(isCssProperty('background-position')).toBe(true);
    expect(isCssProperty('background-size')).toBe(true);
    expect(isCssProperty('background-repeat')).toBe(true);
    expect(isCssProperty('background-origin')).toBe(true);
    expect(isCssProperty('background-clip')).toBe(true);
    expect(isCssProperty('background-attachment')).toBe(true);
  });

  // Every one of these is CSS an agent writes unprompted (or that the render guide itself teaches, like
  // aspect-ratio); rejecting one fails the whole batch, so the vocabulary has to keep carrying them.
  it('returns true for the interaction, effect and typography properties agents reach for', () => {
    for (const property of [
      'pointer-events',
      'user-select',
      'visibility',
      'box-sizing',
      'aspect-ratio',
      'touch-action',
      'resize',
      'appearance',
      'scroll-behavior',
      'overscroll-behavior',
      'accent-color',
      'caret-color',
      'color-scheme',
      'backdrop-filter',
      'mix-blend-mode',
      'background-blend-mode',
      'isolation',
      'clip-path',
      'transform-origin',
      'perspective',
      'will-change',
      'outline-offset',
      'word-break',
      'overflow-wrap',
      'word-spacing',
      'hyphens',
      'vertical-align',
      'text-decoration-thickness',
      'text-underline-offset',
      'line-clamp',
      '-webkit-line-clamp',
      '-webkit-box-orient',
      'border-collapse',
      'border-spacing',
      'table-layout',
      'fill',
      'stroke',
      'stroke-width'
    ]) {
      expect(isCssProperty(property), property).toBe(true);
    }
  });

  it('returns false for unknown properties', () => {
    expect(isCssProperty('nonexistent')).toBe(false);
    expect(isCssProperty('overflow-z')).toBe(false);
  });
});
describe('comma-separated layers', () => {
  it('keeps each transition layer on its own longhand slot', () => {
    const result = expandShorthand({ transition: 'opacity 200ms ease, transform 300ms linear 50ms' });
    expect(result).toEqual({
      'transition-property': 'opacity, transform',
      'transition-duration': '200ms, 300ms',
      'transition-timing-function': 'ease, linear',
      'transition-delay': '0s, 50ms'
    });
  });

  it('fills what one layer omits with the longhand initial value — `initial` in a list voids the declaration', () => {
    const result = expandShorthand({ transition: 'opacity 200ms ease-out 40ms, display 200ms allow-discrete' });
    expect(result).toEqual({
      'transition-property': 'opacity, display',
      'transition-duration': '200ms, 200ms',
      'transition-timing-function': 'ease-out, ease',
      'transition-delay': '40ms, 0s',
      'transition-behavior': 'normal, allow-discrete'
    });
  });

  it('reads allow-discrete as the transition behaviour', () => {
    const result = expandShorthand({ transition: 'display 200ms allow-discrete' });
    expect(result).toEqual({
      'transition-property': 'display',
      'transition-duration': '200ms',
      'transition-behavior': 'allow-discrete'
    });
  });

  it('keeps only the last background layer colour: the colour is no list', () => {
    const result = expandShorthand({ background: 'url(a.png) no-repeat, red url(b.png)' });
    expect(result).toEqual({
      'background-image': 'url(a.png), url(b.png)',
      'background-repeat': 'no-repeat, repeat',
      'background-color': 'red'
    });
  });

  it('keeps each animation layer on its own longhand slot', () => {
    const result = expandShorthand({ animation: 'fade 1s ease, slide 2s linear' });
    expect(result).toEqual({
      'animation-name': 'fade, slide',
      'animation-duration': '1s, 2s',
      'animation-timing-function': 'ease, linear'
    });
  });

  it('keeps each background layer on its own longhand slot', () => {
    const result = expandShorthand({ background: 'url(a.png) no-repeat, url(b.png) repeat-x' });
    expect(result).toEqual({
      'background-image': 'url(a.png), url(b.png)',
      'background-repeat': 'no-repeat, repeat-x'
    });
  });

  it('never splits a comma inside a function', () => {
    const result = expandShorthand({ background: 'linear-gradient(red, blue) no-repeat' });
    expect(result).toEqual({
      'background-image': 'linear-gradient(red, blue)',
      'background-repeat': 'no-repeat'
    });
  });

  it('reads a cubic-bezier timing function as a timing function, not a property', () => {
    const result = expandShorthand({ transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)' });
    expect(result).toEqual({
      'transition-property': 'all',
      'transition-duration': '200ms',
      'transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
  });
});
describe('animation keyword classification', () => {
  it('classifies direction, fill-mode and play-state instead of taking them for the name', () => {
    const result = expandShorthand({ animation: 'spin 2s linear 1s infinite alternate forwards paused' });
    expect(result).toEqual({
      'animation-name': 'spin',
      'animation-duration': '2s',
      'animation-timing-function': 'linear',
      'animation-delay': '1s',
      'animation-iteration-count': 'infinite',
      'animation-direction': 'alternate',
      'animation-fill-mode': 'forwards',
      'animation-play-state': 'paused'
    });
  });
});
describe('grid-row / grid-column', () => {
  it('expands grid-column start and end', () => {
    const result = expandShorthand({ 'grid-column': '1 / 3' });
    expect(result).toEqual({ 'grid-column-start': '1', 'grid-column-end': '3' });
  });

  it('expands grid-row start and end', () => {
    const result = expandShorthand({ 'grid-row': '2 / span 2' });
    expect(result).toEqual({ 'grid-row-start': '2', 'grid-row-end': 'span 2' });
  });

  it('leaves the end auto when only a start is given', () => {
    const result = expandShorthand({ 'grid-column': '2' });
    expect(result).toEqual({ 'grid-column-start': '2', 'grid-column-end': 'auto' });
  });
});
describe('quoted values are never split', () => {
  it('keeps a quoted font family whole', () => {
    const result = expandShorthand({ font: 'bold 16px "Helvetica Neue"' });
    expect(result).toEqual({
      'font-weight': 'bold',
      'font-size': '16px',
      'font-family': '"Helvetica Neue"'
    });
  });
});
describe('every shorthand expands to real CSS properties', () => {
  it('produces only keys the validator accepts', () => {
    for (const shorthand of cssShorthands) {
      const longhands = shorthandLonghands(shorthand);
      expect(longhands, `${shorthand} has no probe`).toBeDefined();
      expect(longhands?.length, `${shorthand} expanded to nothing`).toBeGreaterThan(0);
      for (const longhand of longhands ?? []) {
        expect(isCssProperty(longhand), `${shorthand} → ${longhand} is not a CSS property`).toBe(true);
      }
    }
  });

  it('never leaves a shorthand key in the expanded output', () => {
    for (const shorthand of cssShorthands) {
      expect(shorthandLonghands(shorthand)).not.toContain(shorthand);
    }
  });
});
describe('expandShorthandPatch', () => {
  it('removes every longhand a null shorthand controls', () => {
    expect(expandShorthandPatch({ padding: null })).toEqual({
      'padding-top': null,
      'padding-right': null,
      'padding-bottom': null,
      'padding-left': null
    });
  });

  it('removes all four sides of a null border', () => {
    const result = expandShorthandPatch({ border: null });
    expect(Object.keys(result)).toHaveLength(12);
    expect(result['border-top-width']).toBeNull();
    expect(result['border-left-color']).toBeNull();
  });

  it('leaves a null longhand alone', () => {
    expect(expandShorthandPatch({ 'padding-left': null })).toEqual({ 'padding-left': null });
  });

  it('expands values exactly as expandShorthand does', () => {
    expect(expandShorthandPatch({ padding: '8px' })).toEqual(expandShorthand({ padding: '8px' }));
  });

  it('lets an explicit longhand win over a shorthand in the same patch', () => {
    const result = expandShorthandPatch({ padding: '8px', 'padding-left': null });
    expect(result['padding-top']).toBe('8px');
    expect(result['padding-left']).toBeNull();
  });
});
