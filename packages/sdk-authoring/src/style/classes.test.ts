import { describe, expect, it } from 'vitest';

import { className, styles } from './index';

describe('styles()', () => {
  it('normalises the rules where they are written, not where they are used', () => {
    expect(styles('card', { padding: '24px' }).rules).toEqual({
      desktop: {
        'padding-top': '24px',
        'padding-right': '24px',
        'padding-bottom': '24px',
        'padding-left': '24px'
      }
    });
  });

  it('keeps a per-breakpoint declaration per breakpoint', () => {
    expect(styles('title', { desktop: { 'font-size': '48px' }, mobile: { 'font-size': '30px' } }).rules).toEqual({
      desktop: { 'font-size': '48px' },
      mobile: { 'font-size': '30px' }
    });
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
