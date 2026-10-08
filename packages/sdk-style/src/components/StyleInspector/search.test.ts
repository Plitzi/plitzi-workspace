import { describe, expect, it } from 'vitest';

import {
  BORDER_KEYS,
  CATEGORY_IDS,
  CATEGORY_KEYS,
  EFFECTS_KEYS,
  RAW_STYLE_KEYS,
  TYPOGRAPHY_KEYS
} from './categoryKeys';
import { advancedMatches, categoryMatches, normalizeQuery } from './search';

import type { CategoryId } from './categoryKeys';

const matching = (query: string): CategoryId[] =>
  CATEGORY_IDS.filter(id => categoryMatches(CATEGORY_KEYS[id], normalizeQuery(query)));

describe('normalizeQuery', () => {
  it('writes the words the way property names are written', () => {
    expect(normalizeQuery('  Border Radius ')).toBe('border-radius');
  });

  it('turns the words people use into the property they mean', () => {
    expect(normalizeQuery('bg')).toBe('background');
    expect(normalizeQuery('rounded')).toBe('radius');
  });

  it('is empty for a query of spaces', () => {
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('categoryMatches', () => {
  it('matches everything when nothing is typed', () => {
    expect(matching('')).toEqual(CATEGORY_IDS);
  });

  it('finds a category by a property it edits', () => {
    expect(matching('border radius')).toEqual(['border']);
    expect(matching('z-index')).toEqual(['position']);
  });

  it('finds every category that edits a property of that name', () => {
    expect(matching('shadow')).toEqual(expect.arrayContaining(['typography', 'effects']));
  });

  it('finds a category by its title, including the ones with no properties of their own', () => {
    expect(categoryMatches(RAW_STYLE_KEYS, normalizeQuery('raw style'))).toBe(true);
    expect(categoryMatches(BORDER_KEYS, normalizeQuery('bord'))).toBe(true);
  });

  it('finds nothing for a property no category edits', () => {
    expect(matching('definitely-not-css')).toEqual([]);
  });
});

describe('advancedMatches', () => {
  it('opens the advanced rows when the property lives there', () => {
    expect(advancedMatches(TYPOGRAPHY_KEYS.advanced, normalizeQuery('text shadow'))).toBe(true);
    expect(advancedMatches(EFFECTS_KEYS.advanced, '')).toBe(false);
  });

  it('leaves them closed for a property in the visible rows', () => {
    expect(advancedMatches(TYPOGRAPHY_KEYS.advanced, normalizeQuery('font-size'))).toBe(false);
  });
});
