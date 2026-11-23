import { describe, expect, it } from 'vitest';

import { hueOf, initialsOf } from './faces';

describe('a face', () => {
  it('takes the initials of the first and the last word, and of an address its first letter', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('  grace  brewster murray hopper ')).toBe('GH');
    expect(initialsOf('ada@example.com')).toBe('A');
    expect(initialsOf('álvaro núñez')).toBe('ÁN');
    expect(initialsOf('')).toBe('');
  });

  it('keeps a colour of its own for each name, the same every time', () => {
    expect(hueOf('Ada Lovelace')).toBe(hueOf('Ada Lovelace'));
    expect(hueOf('Ada Lovelace')).not.toBe(hueOf('Grace Hopper'));
    expect(hueOf('Ada Lovelace')).toBeGreaterThanOrEqual(0);
    expect(hueOf('Ada Lovelace')).toBeLessThan(360);
  });
});
