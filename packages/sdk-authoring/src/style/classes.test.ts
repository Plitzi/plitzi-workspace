import { describe, expect, it } from 'vitest';

import { classNames, className, classRefs, isStyleDeclaration, styles } from './index';

describe('styles()', () => {
  it('normalises the rules where they are written, not where they are used', () => {
    expect(styles('card', { padding: '24px' }).rules).toEqual({
      desktop: {
        default: {
          'padding-top': '24px',
          'padding-right': '24px',
          'padding-bottom': '24px',
          'padding-left': '24px'
        }
      }
    });
  });

  it('keeps a per-breakpoint declaration per breakpoint', () => {
    expect(styles('title', { desktop: { 'font-size': '48px' }, mobile: { 'font-size': '30px' } }).rules).toEqual({
      desktop: { default: { 'font-size': '48px' } },
      mobile: { default: { 'font-size': '30px' } }
    });
  });

  it('carries states and variants as parts of the same selector, per breakpoint', () => {
    const card = styles('card', {
      css: { color: 'black' },
      states: { hover: { desktop: { color: 'blue' }, mobile: { color: 'navy' } } },
      variants: {
        active: { 'font-weight': '700' },
        muted: { css: { opacity: '0.5' }, states: { hover: { opacity: '1' } } }
      }
    });

    expect(card.rules).toEqual({
      desktop: {
        default: { color: 'black' },
        states: { hover: { color: 'blue' } },
        variants: {
          active: { default: { 'font-weight': '700' } },
          muted: { default: { opacity: '0.5' }, states: { hover: { opacity: '1' } } }
        }
      },
      mobile: { default: {}, states: { hover: { color: 'navy' } } }
    });
  });

  it('expands shorthands inside a state, and refuses a state the editor has no tab for', () => {
    expect(styles('card', { states: { hover: { padding: '4px' } } }).rules.desktop?.states?.hover).toMatchObject({
      'padding-top': '4px'
    });
    expect(() => styles('card', { states: { hovered: { color: 'red' } } as never })).toThrow(
      /Unknown style state "hovered"/
    );
  });

  // The refusal is the point of normalising early: a property outside the vocabulary is an error on the line that
  // declared the class, not on whichever element happened to name it first.
  it('refuses a property the style editor could not read back', () => {
    expect(() => styles('card', { paddingTop: '4px' })).toThrow(/did you mean "padding-top"/);
  });

  it('reads as its own class name when turned into a string', () => {
    expect(String(styles('card', { color: 'red' }))).toBe('card');
  });
});

describe('className()', () => {
  it('answers a plain name with itself and a declaration with its name', () => {
    expect(className('card')).toBe('card');
    expect(className(styles('card', { color: 'red' }))).toBe('card');
  });
});

describe('class lists', () => {
  const card = styles('card', { padding: '8px' });

  it('reads one class or several as the names a selector joins', () => {
    expect(classNames('card')).toEqual(['card']);
    expect(classNames(card)).toEqual(['card']);
    expect(classNames([card, 'wide', styles('flat', { 'box-shadow': 'none' })])).toEqual(['card', 'wide', 'flat']);
  });

  it('keeps the declarations of a list as they were written, so their rules can be collected', () => {
    expect(classRefs([card, 'wide'])).toEqual([card, 'wide']);
    expect(classRefs(card)).toEqual([card]);
  });
});

describe('isStyleDeclaration()', () => {
  it('tells a declaration from the rule sets a class map also holds', () => {
    expect(isStyleDeclaration(styles('card', { color: 'red' }))).toBe(true);
    expect(isStyleDeclaration({ color: 'red' })).toBe(false);
    expect(isStyleDeclaration({ css: { color: 'red' }, states: { hover: { color: 'blue' } } })).toBe(false);
    expect(isStyleDeclaration({ desktop: { color: 'red' }, mobile: { color: 'blue' } })).toBe(false);
  });
});
