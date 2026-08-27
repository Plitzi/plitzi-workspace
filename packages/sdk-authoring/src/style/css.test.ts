import { describe, expect, it } from 'vitest';

import { css } from './css';
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

  it('passes longhands through unchanged', () => {
    expect(css({ 'font-size': '14px', 'font-weight': 700 })).toEqual({ 'font-size': '14px', 'font-weight': 700 });
  });

  it('is idempotent', () => {
    const once = css({ gap: '24px', 'border-radius': '12px' });

    expect(css(once)).toEqual(once);
  });

  it('names the correct key when a camelCase property is written', () => {
    expect(() => css({ paddingTop: '8px' })).toThrow(/"paddingTop" \(did you mean "padding-top"\?\)/);
  });

  it('refuses a property outside the vocabulary', () => {
    expect(() => css({ 'font-smoothing': 'antialiased' })).toThrow(/Unknown CSS property: "font-smoothing"/);
  });

  it('reports every unknown property at once', () => {
    expect(() => css({ nope: '1px', alsoNope: '2px' })).toThrow(/Unknown CSS properties: "nope", "alsoNope"/);
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
