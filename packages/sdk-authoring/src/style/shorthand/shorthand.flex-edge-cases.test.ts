import { describe, expect, it } from 'vitest';

import { expandShorthand } from './index';

describe('malformed / unsupported shorthands', () => {
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
});
