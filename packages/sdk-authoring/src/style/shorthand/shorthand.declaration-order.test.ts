import { describe, expect, it } from 'vitest';

import { expandShorthand, expandShorthandPatch } from './index';

describe('expandShorthand', () => {
  describe('declaration order', () => {
    it('lets a longhand written after its shorthand override it', () => {
      expect(expandShorthand({ padding: '8px', 'padding-left': '0' })).toMatchObject({
        'padding-top': '8px',
        'padding-left': '0'
      });
    });

    it('lets a border written after one of its sides override that side', () => {
      expect(expandShorthand({ 'border-top-color': 'red', border: '1px solid blue' })).toMatchObject({
        'border-top-color': 'blue',
        'border-left-color': 'blue'
      });
    });

    it('clears or sets by the same order in a patch: the later key decides', () => {
      expect(expandShorthandPatch({ 'padding-left': '4px', padding: null })).toMatchObject({
        'padding-left': null,
        'padding-top': null
      });
      expect(expandShorthandPatch({ padding: null, 'padding-left': '4px' })).toMatchObject({
        'padding-left': '4px',
        'padding-top': null
      });
    });

    it('lets a shorthand written after its longhands override them, as a stylesheet does', () => {
      expect(expandShorthand({ 'overflow-x': 'hidden', 'overflow-y': 'hidden', overflow: 'scroll' })).toEqual({
        'overflow-x': 'scroll',
        'overflow-y': 'scroll'
      });
    });
  });
  describe('overflow', () => {
    it('expands single value to both axes', () => {
      const result = expandShorthand({ overflow: 'hidden' });
      expect(result).toEqual({ 'overflow-x': 'hidden', 'overflow-y': 'hidden' });
    });

    it('expands two values to x and y', () => {
      const result = expandShorthand({ overflow: 'hidden auto' });
      expect(result).toEqual({ 'overflow-x': 'hidden', 'overflow-y': 'auto' });
    });

    it('expands single visible value to both axes', () => {
      const result = expandShorthand({ overflow: 'visible' });
      expect(result).toEqual({ 'overflow-x': 'visible', 'overflow-y': 'visible' });
    });

    it('passes through longhand overflow-x', () => {
      const result = expandShorthand({ 'overflow-x': 'scroll' });
      expect(result).toEqual({ 'overflow-x': 'scroll' });
    });

    it('passes through longhand overflow-y', () => {
      const result = expandShorthand({ 'overflow-y': 'auto' });
      expect(result).toEqual({ 'overflow-y': 'auto' });
    });
  });
  describe('flex', () => {
    it('expands single number to grow/shrink/basis', () => {
      const result = expandShorthand({ flex: '1' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '0%' });
    });

    it('expands single length to basis with default grow/shrink', () => {
      const result = expandShorthand({ flex: '100px' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '100px' });
    });

    it('expands two numbers to grow and shrink', () => {
      const result = expandShorthand({ flex: '2 1' });
      expect(result).toEqual({ 'flex-grow': '2', 'flex-shrink': '1', 'flex-basis': '0%' });
    });

    it('expands number + length to grow and basis', () => {
      const result = expandShorthand({ flex: '1 200px' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '200px' });
    });

    it('expands three values to grow/shrink/basis', () => {
      const result = expandShorthand({ flex: '1 0 100px' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '0', 'flex-basis': '100px' });
    });
  });
  describe('flex-flow', () => {
    it('expands single direction', () => {
      const result = expandShorthand({ 'flex-flow': 'column' });
      expect(result).toEqual({ 'flex-direction': 'column' });
    });

    it('expands direction + wrap', () => {
      const result = expandShorthand({ 'flex-flow': 'row wrap' });
      expect(result).toEqual({ 'flex-direction': 'row', 'flex-wrap': 'wrap' });
    });

    it('expands wrap only', () => {
      const result = expandShorthand({ 'flex-flow': 'wrap-reverse' });
      expect(result).toEqual({ 'flex-wrap': 'wrap-reverse' });
    });
  });
  describe('place-* shorthands', () => {
    it('expands place-items with single value', () => {
      const result = expandShorthand({ 'place-items': 'center' });
      expect(result).toEqual({ 'align-items': 'center', 'justify-items': 'center' });
    });

    it('expands place-items with two values', () => {
      const result = expandShorthand({ 'place-items': 'start center' });
      expect(result).toEqual({ 'align-items': 'start', 'justify-items': 'center' });
    });

    it('expands place-self with single value', () => {
      const result = expandShorthand({ 'place-self': 'stretch' });
      expect(result).toEqual({ 'align-self': 'stretch', 'justify-self': 'stretch' });
    });

    it('expands place-self with two values', () => {
      const result = expandShorthand({ 'place-self': 'start center' });
      expect(result).toEqual({ 'align-self': 'start', 'justify-self': 'center' });
    });

    it('expands place-content with single value', () => {
      const result = expandShorthand({ 'place-content': 'center' });
      expect(result).toEqual({ 'align-content': 'center', 'justify-content': 'center' });
    });

    it('expands place-content with two values', () => {
      const result = expandShorthand({ 'place-content': 'space-between center' });
      expect(result).toEqual({ 'align-content': 'space-between', 'justify-content': 'center' });
    });
  });
  describe('grid-area', () => {
    it('expands single value to all positions', () => {
      const result = expandShorthand({ 'grid-area': '1' });
      expect(result).toEqual({
        'grid-row-start': '1',
        'grid-column-start': '1',
        'grid-row-end': '1',
        'grid-column-end': '1'
      });
    });

    it('expands two values to row/column start', () => {
      const result = expandShorthand({ 'grid-area': '1 / 2' });
      expect(result).toEqual({
        'grid-row-start': '1',
        'grid-column-start': '2',
        'grid-row-end': '2',
        'grid-column-end': '2'
      });
    });

    it('expands four values', () => {
      const result = expandShorthand({ 'grid-area': '1 / 2 / 3 / 4' });
      expect(result).toEqual({
        'grid-row-start': '1',
        'grid-column-start': '2',
        'grid-row-end': '3',
        'grid-column-end': '4'
      });
    });
  });
  describe('columns', () => {
    it('expands length to column-width', () => {
      const result = expandShorthand({ columns: '200px' });
      expect(result).toEqual({ 'column-width': '200px' });
    });

    it('expands number to column-count', () => {
      const result = expandShorthand({ columns: '3' });
      expect(result).toEqual({ 'column-count': '3' });
    });

    it('expands two values to width and count', () => {
      const result = expandShorthand({ columns: '200px 3' });
      expect(result).toEqual({ 'column-width': '200px', 'column-count': '3' });
    });
  });
  describe('outline', () => {
    it('expands tokens to outline properties', () => {
      const result = expandShorthand({ outline: '2px solid blue' });
      expect(result).toEqual({
        'outline-width': '2px',
        'outline-style': 'solid',
        'outline-color': 'blue'
      });
    });

    it('fills the omitted longhands with their initial value', () => {
      const result = expandShorthand({ outline: 'dashed' });
      expect(result).toEqual({ 'outline-width': 'medium', 'outline-style': 'dashed', 'outline-color': 'currentcolor' });
    });

    it('handles single outline-width', () => {
      const result = expandShorthand({ outline: '2px' });
      expect(result).toEqual({ 'outline-width': '2px', 'outline-style': 'none', 'outline-color': 'currentcolor' });
    });

    it('handles single outline-color', () => {
      const result = expandShorthand({ outline: 'blue' });
      expect(result).toEqual({ 'outline-width': 'medium', 'outline-style': 'none', 'outline-color': 'blue' });
    });
  });
  describe('list-style', () => {
    it('expands type and position', () => {
      const result = expandShorthand({ 'list-style': 'disc inside' });
      expect(result).toEqual({
        'list-style-type': 'disc',
        'list-style-position': 'inside'
      });
    });

    it('handles type only', () => {
      const result = expandShorthand({ 'list-style': 'square' });
      expect(result).toEqual({ 'list-style-type': 'square' });
    });

    it('handles position only', () => {
      const result = expandShorthand({ 'list-style': 'inside' });
      expect(result).toEqual({ 'list-style-position': 'inside' });
    });

    it('handles image only', () => {
      const result = expandShorthand({ 'list-style': 'url(icon.png)' });
      expect(result).toEqual({ 'list-style-image': 'url(icon.png)' });
    });

    it('handles url image', () => {
      const result = expandShorthand({ 'list-style': 'url(icon.png) outside' });
      expect(result).toEqual({
        'list-style-image': 'url(icon.png)',
        'list-style-position': 'outside'
      });
    });
  });
  describe('text-decoration', () => {
    it('expands line and color', () => {
      const result = expandShorthand({ 'text-decoration': 'underline red' });
      expect(result).toEqual({
        'text-decoration-line': 'underline',
        'text-decoration-color': 'red'
      });
    });

    it('expands line, color, and style', () => {
      const result = expandShorthand({ 'text-decoration': 'underline red dashed' });
      expect(result).toEqual({
        'text-decoration-line': 'underline',
        'text-decoration-color': 'red',
        'text-decoration-style': 'dashed'
      });
    });

    it('handles none', () => {
      const result = expandShorthand({ 'text-decoration': 'none' });
      expect(result).toEqual({ 'text-decoration-line': 'none' });
    });

    it('handles line only', () => {
      const result = expandShorthand({ 'text-decoration': 'underline' });
      expect(result).toEqual({ 'text-decoration-line': 'underline' });
    });

    it('handles color only', () => {
      const result = expandShorthand({ 'text-decoration': 'red' });
      expect(result).toEqual({ 'text-decoration-color': 'red' });
    });

    it('handles style only', () => {
      const result = expandShorthand({ 'text-decoration': 'wavy' });
      expect(result).toEqual({ 'text-decoration-style': 'wavy' });
    });
  });
  describe('transition', () => {
    it('expands property, duration, timing-function', () => {
      const result = expandShorthand({ transition: 'opacity 200ms ease' });
      expect(result).toEqual({
        'transition-property': 'opacity',
        'transition-duration': '200ms',
        'transition-timing-function': 'ease'
      });
    });

    it('expands all four parts', () => {
      const result = expandShorthand({ transition: 'all 300ms linear 100ms' });
      expect(result).toEqual({
        'transition-property': 'all',
        'transition-duration': '300ms',
        'transition-timing-function': 'linear',
        'transition-delay': '100ms'
      });
    });

    it('handles property only', () => {
      const result = expandShorthand({ transition: 'opacity' });
      expect(result).toEqual({ 'transition-property': 'opacity' });
    });

    it('handles duration only', () => {
      const result = expandShorthand({ transition: '200ms' });
      expect(result).toEqual({ 'transition-duration': '200ms' });
    });

    it('handles timing-function only', () => {
      const result = expandShorthand({ transition: 'ease-in-out' });
      expect(result).toEqual({ 'transition-timing-function': 'ease-in-out' });
    });
  });
  describe('animation', () => {
    it('expands name, duration, timing-function', () => {
      const result = expandShorthand({ animation: 'fadeIn 1s ease' });
      expect(result).toEqual({
        'animation-name': 'fadeIn',
        'animation-duration': '1s',
        'animation-timing-function': 'ease'
      });
    });

    it('handles infinite iteration count', () => {
      const result = expandShorthand({ animation: 'pulse 2s infinite' });
      expect(result).toEqual({
        'animation-name': 'pulse',
        'animation-duration': '2s',
        'animation-iteration-count': 'infinite'
      });
    });

    it('handles duration only', () => {
      const result = expandShorthand({ animation: '500ms' });
      expect(result).toEqual({ 'animation-duration': '500ms' });
    });

    it('handles timing-function only', () => {
      const result = expandShorthand({ animation: 'ease-in' });
      expect(result).toEqual({ 'animation-timing-function': 'ease-in' });
    });
  });
  describe('background', () => {
    it('expands color and repeat', () => {
      const result = expandShorthand({ background: 'red no-repeat' });
      expect(result).toEqual({
        'background-color': 'red',
        'background-repeat': 'no-repeat'
      });
    });

    it('expands url image', () => {
      const result = expandShorthand({ background: 'url(bg.png) center' });
      expect(result).toEqual({
        'background-image': 'url(bg.png)',
        'background-position': 'center'
      });
    });

    it('expands size keyword', () => {
      const result = expandShorthand({ background: 'cover' });
      expect(result).toEqual({ 'background-size': 'cover' });
    });

    it('handles color only', () => {
      const result = expandShorthand({ background: 'blue' });
      expect(result).toEqual({ 'background-color': 'blue' });
    });

    it('handles repeat only', () => {
      const result = expandShorthand({ background: 'no-repeat' });
      expect(result).toEqual({ 'background-repeat': 'no-repeat' });
    });

    it('handles position only', () => {
      const result = expandShorthand({ background: 'center' });
      expect(result).toEqual({ 'background-position': 'center' });
    });

    it('handles url image only', () => {
      const result = expandShorthand({ background: 'url(bg.png)' });
      expect(result).toEqual({ 'background-image': 'url(bg.png)' });
    });
  });
  describe('font', () => {
    it('expands style, weight, size, family', () => {
      const result = expandShorthand({ font: 'italic bold 16px Arial' });
      expect(result).toEqual({
        'font-style': 'italic',
        'font-weight': 'bold',
        'font-size': '16px',
        'font-family': 'Arial'
      });
    });

    it('expands size and family only', () => {
      const result = expandShorthand({ font: '14px Helvetica' });
      expect(result).toEqual({
        'font-size': '14px',
        'font-family': 'Helvetica'
      });
    });

    it('expands with font-variant', () => {
      const result = expandShorthand({ font: 'small-caps bold 16px Arial' });
      expect(result).toEqual({
        'font-variant': 'small-caps',
        'font-weight': 'bold',
        'font-size': '16px',
        'font-family': 'Arial'
      });
    });

    it('expands with line-height after size', () => {
      const result = expandShorthand({ font: '16px/1.5 Arial' });
      expect(result).toEqual({
        'font-size': '16px',
        'line-height': '1.5',
        'font-family': 'Arial'
      });
    });
  });
  describe('transition', () => {
    it('expands single duration value', () => {
      const result = expandShorthand({ transition: '200ms' });
      expect(result).toEqual({ 'transition-duration': '200ms' });
    });

    it('expands property and duration', () => {
      const result = expandShorthand({ transition: 'opacity 300ms' });
      expect(result).toEqual({
        'transition-property': 'opacity',
        'transition-duration': '300ms'
      });
    });
  });
  describe('animation', () => {
    it('expands with delay', () => {
      const result = expandShorthand({ animation: 'fadeIn 1s ease 200ms' });
      expect(result).toEqual({
        'animation-name': 'fadeIn',
        'animation-duration': '1s',
        'animation-timing-function': 'ease',
        'animation-delay': '200ms'
      });
    });

    it('expands with numeric iteration count', () => {
      const result = expandShorthand({ animation: 'pulse 2s 3' });
      expect(result).toEqual({
        'animation-name': 'pulse',
        'animation-duration': '2s',
        'animation-iteration-count': '3'
      });
    });
  });
});
