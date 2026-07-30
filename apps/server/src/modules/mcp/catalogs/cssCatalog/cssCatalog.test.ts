import { describe, expect, it } from 'vitest';

import { cssShorthands, expandShorthand, expandShorthandPatch, isCssProperty, shorthandLonghands } from './index';

describe('expandShorthand', () => {
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

  describe('flex edge cases', () => {
    it('two non-numeric tokens produce no longhands', () => {
      const result = expandShorthand({ flex: 'bogus bogus' });
      expect(result).toEqual({});
    });

    it('reads the named keyword forms as their grow/shrink/basis triple', () => {
      expect(expandShorthand({ flex: 'auto' })).toEqual({
        'flex-grow': '1',
        'flex-shrink': '1',
        'flex-basis': 'auto'
      });
      expect(expandShorthand({ flex: 'none' })).toEqual({
        'flex-grow': '0',
        'flex-shrink': '0',
        'flex-basis': 'auto'
      });
      expect(expandShorthand({ flex: 'initial' })).toEqual({
        'flex-grow': '0',
        'flex-shrink': '1',
        'flex-basis': 'auto'
      });
    });

    it('length + non-number two-token produces nothing', () => {
      const result = expandShorthand({ flex: '100px auto' });
      expect(result).toEqual({});
    });

    it('number + keyword basis is accepted (flex: 1 max-content)', () => {
      const result = expandShorthand({ flex: '1 max-content' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': 'max-content' });
    });

    it('single number with percentage basis', () => {
      const result = expandShorthand({ flex: '50%' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '50%' });
    });

    it('number + normal keyword for basis', () => {
      const result = expandShorthand({ flex: '1 normal' });
      expect(result).toEqual({ 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': 'normal' });
    });
  });

  describe('flex-flow edge cases', () => {
    it('unrecognized token is silently dropped', () => {
      const result = expandShorthand({ 'flex-flow': 'bogus' });
      expect(result).toEqual({});
    });

    it('two directions last one wins', () => {
      const result = expandShorthand({ 'flex-flow': 'column row' });
      expect(result).toEqual({ 'flex-direction': 'row' });
    });

    it('two wraps last one wins', () => {
      const result = expandShorthand({ 'flex-flow': 'wrap nowrap' });
      expect(result).toEqual({ 'flex-wrap': 'nowrap' });
    });
  });

  describe('place-* edge cases', () => {
    it('single unknown value still produces both longhands', () => {
      const result = expandShorthand({ 'place-items': 'bogus' });
      expect(result).toEqual({ 'align-items': 'bogus', 'justify-items': 'bogus' });
    });

    it('place-self two different values', () => {
      const result = expandShorthand({ 'place-self': 'start end' });
      expect(result).toEqual({ 'align-self': 'start', 'justify-self': 'end' });
    });

    it('place-content two values', () => {
      const result = expandShorthand({ 'place-content': 'space-around safe' });
      expect(result).toEqual({ 'align-content': 'space-around', 'justify-content': 'safe' });
    });
  });

  describe('grid-area edge cases', () => {
    it('3 values fills col-end from row-end', () => {
      const result = expandShorthand({ 'grid-area': '1 / 2 / 3' });
      expect(result).toEqual({
        'grid-row-start': '1',
        'grid-column-start': '2',
        'grid-row-end': '3',
        'grid-column-end': '3'
      });
    });

    it('slash without spaces is normalized', () => {
      const result = expandShorthand({ 'grid-area': '1/2/3/4' });
      expect(result).toEqual({
        'grid-row-start': '1',
        'grid-column-start': '2',
        'grid-row-end': '3',
        'grid-column-end': '4'
      });
    });

    it('named area single value fills all positions', () => {
      const result = expandShorthand({ 'grid-area': 'header' });
      expect(result).toEqual({
        'grid-row-start': 'header',
        'grid-column-start': 'header',
        'grid-row-end': 'header',
        'grid-column-end': 'header'
      });
    });
  });

  describe('columns edge cases', () => {
    it('reads the first two tokens and ignores the rest', () => {
      const result = expandShorthand({ columns: '200px 3 auto' });
      expect(result).toEqual({ 'column-width': '200px', 'column-count': '3' });
    });

    it('accepts count-before-width order', () => {
      const result = expandShorthand({ columns: '3 200px' });
      expect(result).toEqual({ 'column-width': '200px', 'column-count': '3' });
    });

    it('unrecognized token becomes column-width', () => {
      const result = expandShorthand({ columns: 'auto' });
      expect(result).toEqual({ 'column-width': 'auto' });
    });
  });

  describe('outline edge cases', () => {
    it('all tokens classified by border logic', () => {
      const result = expandShorthand({ outline: 'thick dotted red' });
      expect(result).toEqual({
        'outline-width': 'thick',
        'outline-style': 'dotted',
        'outline-color': 'red'
      });
    });

    it('multiple same-type tokens last wins', () => {
      const result = expandShorthand({ outline: 'solid dashed' });
      expect(result).toEqual({ 'outline-width': 'medium', 'outline-style': 'dashed', 'outline-color': 'currentcolor' });
    });
  });

  describe('list-style edge cases', () => {
    it('unknown token is silently dropped', () => {
      const result = expandShorthand({ 'list-style': 'bogus' });
      expect(result).toEqual({});
    });

    it('all three types present', () => {
      const result = expandShorthand({ 'list-style': 'disc inside url(icon.png)' });
      expect(result).toEqual({
        'list-style-type': 'disc',
        'list-style-position': 'inside',
        'list-style-image': 'url(icon.png)'
      });
    });

    it('none as a type is recognized', () => {
      const result = expandShorthand({ 'list-style': 'none' });
      expect(result).toEqual({ 'list-style-type': 'none' });
    });
  });

  describe('text-decoration edge cases', () => {
    it('unknown color token falls through as color', () => {
      const result = expandShorthand({ 'text-decoration': 'underline bogus' });
      expect(result).toEqual({
        'text-decoration-line': 'underline',
        'text-decoration-color': 'bogus'
      });
    });

    it('single style token is classified as style', () => {
      const result = expandShorthand({ 'text-decoration': 'wavy' });
      expect(result).toEqual({ 'text-decoration-style': 'wavy' });
    });

    it('multiple line values last wins', () => {
      const result = expandShorthand({ 'text-decoration': 'underline overline' });
      expect(result).toEqual({ 'text-decoration-line': 'overline' });
    });

    it('overline alone is recognized', () => {
      const result = expandShorthand({ 'text-decoration': 'overline' });
      expect(result).toEqual({ 'text-decoration-line': 'overline' });
    });
  });

  describe('transition edge cases', () => {
    it('only timing function produces no duration', () => {
      const result = expandShorthand({ transition: 'ease' });
      expect(result).toEqual({ 'transition-timing-function': 'ease' });
    });

    it('two time values first becomes duration second becomes delay', () => {
      const result = expandShorthand({ transition: '200ms 100ms' });
      expect(result).toEqual({ 'transition-duration': '200ms', 'transition-delay': '100ms' });
    });

    it('unitless number becomes duration', () => {
      const result = expandShorthand({ transition: 'opacity 0.3s' });
      expect(result).toEqual({ 'transition-property': 'opacity', 'transition-duration': '0.3s' });
    });

    it('property + cubic-bezier', () => {
      const result = expandShorthand({ transition: 'all cubic-bezier(0.4,0,0.2,1)' });
      expect(result).toEqual({
        'transition-property': 'all',
        'transition-timing-function': 'cubic-bezier(0.4,0,0.2,1)'
      });
    });

    it('unrecognized property name passes through', () => {
      const result = expandShorthand({ transition: 'my-custom-prop 1s' });
      expect(result).toEqual({ 'transition-property': 'my-custom-prop', 'transition-duration': '1s' });
    });
  });

  describe('animation edge cases', () => {
    it('name only produces no duration', () => {
      const result = expandShorthand({ animation: 'fadeIn' });
      expect(result).toEqual({ 'animation-name': 'fadeIn' });
    });

    it('numeric value before name is iteration count', () => {
      const result = expandShorthand({ animation: '3 pulse 2s' });
      expect(result).toEqual({
        'animation-iteration-count': '3',
        'animation-name': 'pulse',
        'animation-duration': '2s'
      });
    });

    it('infinite before name is iteration count', () => {
      const result = expandShorthand({ animation: 'infinite pulse 2s' });
      expect(result).toEqual({
        'animation-iteration-count': 'infinite',
        'animation-name': 'pulse',
        'animation-duration': '2s'
      });
    });

    it('two time values first is duration second is delay', () => {
      const result = expandShorthand({ animation: 'fadeIn 2s 1s' });
      expect(result).toEqual({
        'animation-name': 'fadeIn',
        'animation-duration': '2s',
        'animation-delay': '1s'
      });
    });

    it('cubic-bezier is recognized as timing function', () => {
      const result = expandShorthand({ animation: 'fadeIn 2s cubic-bezier(0.1,0.7,1,0.1)' });
      expect(result).toEqual({
        'animation-name': 'fadeIn',
        'animation-duration': '2s',
        'animation-timing-function': 'cubic-bezier(0.1,0.7,1,0.1)'
      });
    });

    it('numeric iteration count after duration', () => {
      const result = expandShorthand({ animation: 'pulse 2s 3' });
      expect(result).toEqual({
        'animation-name': 'pulse',
        'animation-duration': '2s',
        'animation-iteration-count': '3'
      });
    });
  });

  describe('background edge cases', () => {
    it('unknown token is treated as color', () => {
      const result = expandShorthand({ background: 'bogus' });
      expect(result).toEqual({ 'background-color': 'bogus' });
    });

    it('linear-gradient is recognized as image', () => {
      const result = expandShorthand({ background: 'linear-gradient(red, blue)' });
      expect(result).toEqual({ 'background-image': 'linear-gradient(red, blue)' });
    });

    it('radial-gradient is recognized as image', () => {
      const result = expandShorthand({ background: 'radial-gradient(circle, red)' });
      expect(result).toEqual({ 'background-image': 'radial-gradient(circle, red)' });
    });

    it('contain keyword is recognized as size', () => {
      const result = expandShorthand({ background: 'contain' });
      expect(result).toEqual({ 'background-size': 'contain' });
    });

    it('repeat-x is recognized', () => {
      const result = expandShorthand({ background: 'repeat-x' });
      expect(result).toEqual({ 'background-repeat': 'repeat-x' });
    });

    it('position keywords accumulate', () => {
      const result = expandShorthand({ background: 'center top' });
      expect(result).toEqual({ 'background-position': 'center top' });
    });

    it('splits a position/size slash written without spaces', () => {
      const result = expandShorthand({ background: 'center/cover' });
      expect(result).toEqual({ 'background-position': 'center', 'background-size': 'cover' });
    });

    it('color + repeat + position combined', () => {
      const result = expandShorthand({ background: 'red no-repeat center' });
      expect(result).toEqual({
        'background-color': 'red',
        'background-repeat': 'no-repeat',
        'background-position': 'center'
      });
    });

    it('url with nested parentheses stays intact', () => {
      const result = expandShorthand({ background: 'url(data:image/png;base64,abc)' });
      expect(result).toEqual({ 'background-image': 'url(data:image/png;base64,abc)' });
    });
  });

  describe('font edge cases', () => {
    it('font without family produces only font-size', () => {
      const result = expandShorthand({ font: '16px' });
      expect(result).toEqual({ 'font-size': '16px' });
    });

    it('slash between size and line-height without spaces', () => {
      const result = expandShorthand({ font: '16px/1.5 Arial' });
      expect(result).toEqual({
        'font-size': '16px',
        'line-height': '1.5',
        'font-family': 'Arial'
      });
    });

    it('normal as style keyword', () => {
      const result = expandShorthand({ font: 'normal 16px Arial' });
      expect(result).toEqual({
        'font-style': 'normal',
        'font-size': '16px',
        'font-family': 'Arial'
      });
    });

    it('oblique as style keyword', () => {
      const result = expandShorthand({ font: 'oblique 12px serif' });
      expect(result).toEqual({
        'font-style': 'oblique',
        'font-size': '12px',
        'font-family': 'serif'
      });
    });

    it('multiple family tokens concatenate', () => {
      const result = expandShorthand({ font: '14px Helvetica Neue' });
      expect(result).toEqual({
        'font-size': '14px',
        'font-family': 'Helvetica Neue'
      });
    });

    it('quoted family name stays as single token', () => {
      const result = expandShorthand({ font: '14px "Helvetica Neue"' });
      expect(result).toEqual({
        'font-size': '14px',
        'font-family': '"Helvetica Neue"'
      });
    });

    it('size with line-height and family', () => {
      const result = expandShorthand({ font: '16px/1.5 "Open Sans"' });
      expect(result).toEqual({
        'font-size': '16px',
        'line-height': '1.5',
        'font-family': '"Open Sans"'
      });
    });

    it('reads the token after the slash as the line-height', () => {
      const result = expandShorthand({ font: '16px/normal Arial' });
      expect(result).toEqual({
        'font-size': '16px',
        'line-height': 'normal',
        'font-family': 'Arial'
      });
    });

    it('numeric weight like 700', () => {
      const result = expandShorthand({ font: 'italic 700 16px Arial' });
      expect(result).toEqual({
        'font-style': 'italic',
        'font-weight': '700',
        'font-size': '16px',
        'font-family': 'Arial'
      });
    });
  });

  describe('grid / grid-template edge cases', () => {
    it('none value goes to columns', () => {
      const result = expandShorthand({ grid: 'none' });
      expect(result).toEqual({ 'grid-template-columns': 'none' });
    });

    it('auto value goes to columns', () => {
      const result = expandShorthand({ grid: 'auto' });
      expect(result).toEqual({ 'grid-template-columns': 'auto' });
    });

    it('bracket notation goes to columns', () => {
      const result = expandShorthand({ grid: '[col-start] 1fr [col-end]' });
      expect(result).toEqual({ 'grid-template-columns': '[col-start] 1fr [col-end]' });
    });

    it('keeps a multi-word quoted area string whole', () => {
      const result = expandShorthand({ grid: '"header header"' });
      expect(result).toEqual({ 'grid-template-areas': '"header header"' });
    });

    it('mixed row sizes and areas', () => {
      const result = expandShorthand({ 'grid-template': '1fr 2fr "header" "main"' });
      expect(result).toEqual({
        'grid-template-rows': '1fr 2fr',
        'grid-template-areas': '"header" "main"'
      });
    });

    it('minmax() in columns', () => {
      const result = expandShorthand({ grid: 'minmax(0,1fr) 2fr' });
      expect(result).toEqual({ 'grid-template-columns': 'minmax(0,1fr) 2fr' });
    });

    it('repeat() in columns', () => {
      const result = expandShorthand({ grid: 'repeat(3,1fr)' });
      expect(result).toEqual({ 'grid-template-columns': 'repeat(3,1fr)' });
    });
  });

  describe('gap edge cases', () => {
    it('single value duplicates to both axes', () => {
      const result = expandShorthand({ gap: '8px' });
      expect(result).toEqual({ 'row-gap': '8px', 'column-gap': '8px' });
    });

    it('two values set row and column separately', () => {
      const result = expandShorthand({ gap: '10px 20px' });
      expect(result).toEqual({ 'row-gap': '10px', 'column-gap': '20px' });
    });
  });

  describe('border edge cases', () => {
    it('transparent is classified as color', () => {
      const result = expandShorthand({ border: '1px solid transparent' });
      expect(result).toHaveProperty('border-top-color', 'transparent');
    });

    it('currentcolor is classified as color', () => {
      const result = expandShorthand({ border: 'currentcolor' });
      expect(result).toHaveProperty('border-top-color', 'currentcolor');
    });

    it('inherit keyword classified as color', () => {
      const result = expandShorthand({ border: 'inherit' });
      expect(result).toHaveProperty('border-top-color', 'inherit');
    });

    it('multiple of same type last wins', () => {
      const result = expandShorthand({ border: 'solid dashed' });
      expect(result).toHaveProperty('border-top-style', 'dashed');
    });

    it('percentage width', () => {
      const result = expandShorthand({ border: '5% solid red' });
      expect(result).toHaveProperty('border-top-width', '5%');
      expect(result).toHaveProperty('border-top-color', 'red');
    });

    it('negative length width', () => {
      const result = expandShorthand({ border: '-2px solid red' });
      expect(result).toHaveProperty('border-top-width', '-2px');
    });
  });

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
      'transition-delay': 'initial, 50ms'
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
