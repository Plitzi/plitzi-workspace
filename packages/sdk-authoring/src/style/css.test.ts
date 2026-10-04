import { describe, expect, it } from 'vitest';

import { css, toBlocks, toResponsive } from './css';
import { column, grid, row } from './layout';

describe('css', () => {
  it('expands shorthands the style editor has no control for', () => {
    expect(css({ padding: '96px 24px' })).toEqual({
      'padding-top': '96px',
      'padding-right': '24px',
      'padding-bottom': '96px',
      'padding-left': '24px'
    });
  });

  // A scene in 3D — a disc tilted back, things standing up on it — and a transform built of its parts.
  it('takes the 3D properties and the transform parts, each a property of its own', () => {
    const scene = {
      'transform-style': 'preserve-3d',
      perspective: '1600px',
      'perspective-origin': '50% 30%',
      'backface-visibility': 'hidden',
      translate: '0 24px',
      rotate: '-6deg'
    };

    expect(css(scene)).toEqual(scene);
  });

  it('reads a bare number for `scale` as the factor it is, not a length', () => {
    expect(css({ scale: 0.94 })).toEqual({ scale: 0.94 });
  });

  // What a marketing page masks and highlights with: a dotted map faded at its edges, a heading tinted line by line.
  it('takes masks, the prefixed text clip and box-decoration-break', () => {
    const effects = {
      'mask-image': 'radial-gradient(black, transparent)',
      '-webkit-mask-image': 'radial-gradient(black, transparent)',
      'mask-size': '8px 8px',
      'mask-position': 'center',
      'mask-repeat': 'repeat',
      'mask-composite': 'intersect',
      '-webkit-background-clip': 'text',
      'box-decoration-break': 'clone',
      '-webkit-box-decoration-break': 'clone'
    };

    expect(css(effects)).toEqual(effects);
  });

  it('passes longhands through unchanged', () => {
    expect(css({ 'font-size': '14px', 'font-weight': 700 })).toEqual({ 'font-size': '14px', 'font-weight': 700 });
  });

  it('is idempotent', () => {
    const once = css({ gap: '24px', 'border-radius': '12px' });

    expect(css(once)).toEqual(once);
  });

  // A React style object is written that way by every agent and developer: the document keeps kebab-case either way.
  it('reads camelCase keys, and a bare number on a length as pixels', () => {
    expect(css({ paddingTop: 8, fontWeight: 800, opacity: 0.25, WebkitLineClamp: 2, gap: 0 })).toEqual({
      'padding-top': '8px',
      'font-weight': 800,
      opacity: 0.25,
      '-webkit-line-clamp': 2,
      'row-gap': '0',
      'column-gap': '0'
    });
  });

  it('refuses one property written twice under its two spellings', () => {
    expect(() => css({ paddingTop: '8px', 'padding-top': '4px' })).toThrow(/`padding-top` is written twice/);
  });

  it('takes a value per breakpoint in place, without splitting the rule set', () => {
    expect(toResponsive({ fontSize: { desktop: '24px', compact: '18px' }, fontWeight: 700 })).toEqual({
      desktop: { 'font-size': '24px', 'font-weight': 700 },
      tablet: { 'font-size': '18px' },
      mobile: { 'font-size': '18px' }
    });
  });

  it('refuses a property outside the vocabulary, and says what to do with a standard one meanwhile', () => {
    expect(() => css({ 'font-smoothing': 'antialiased' })).toThrow(/Unknown CSS property: "font-smoothing"/);
    expect(() => css({ 'font-smoothing': 'antialiased' })).toThrow(/write it in the space's `customCss`/);
  });

  /** A container query's `cqw` units measure an element that says it is a container. */
  it('takes what a container query needs', () => {
    expect(css({ containerType: 'inline-size', containerName: 'card' })).toEqual({
      'container-type': 'inline-size',
      'container-name': 'card'
    });
  });

  it('reports every unknown property at once', () => {
    expect(() => css({ nope: '1px', alsoNope: '2px' })).toThrow(/Unknown CSS properties: "nope", "also-nope"/);
  });

  it('allows custom properties', () => {
    expect(css({ '--brand': '#4422ee', color: 'var(--brand)' })).toEqual({
      '--brand': '#4422ee',
      color: 'var(--brand)'
    });
  });

  it('lets an explicit longhand win over the shorthand it sits beside', () => {
    expect(css({ padding: '8px', 'padding-left': '0px' })).toMatchObject({ 'padding-left': '0px' });
  });
});

describe('a style with states, variants or ancestors', () => {
  it('refuses its rules written beside them, and says to put them under `css`', () => {
    expect(() =>
      toBlocks({ desktop: { marginLeft: '10px' }, ancestors: { card: { states: { hover: { color: 'red' } } } } })
    ).toThrow(/\[rule-set-mixed\][^]*its own rules go under `css`: `\{ css: \{ desktop: … \}, ancestors: \{ … \} \}`/);
  });
});

describe('layout combinators', () => {
  it('column is the two display declarations plus the gap', () => {
    expect(column('24px')).toEqual({
      display: 'flex',
      'flex-direction': 'column',
      'row-gap': '24px',
      'column-gap': '24px'
    });
  });

  it('row takes extra rules, expanded like any other', () => {
    expect(row('8px', { padding: '4px' })).toMatchObject({
      'flex-direction': 'row',
      'padding-top': '4px',
      'padding-left': '4px'
    });
  });

  it('grid carries its template', () => {
    expect(grid('repeat(3, 1fr)', '16px')).toMatchObject({
      display: 'grid',
      'grid-template-columns': 'repeat(3, 1fr)',
      'row-gap': '16px'
    });
  });

  it('refuses an invalid extra rule at the line that wrote it', () => {
    expect(() => column('24px', { padddding: '4px' })).toThrow(/Unknown CSS property/);
  });
});
