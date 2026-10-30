import { describe, expect, it } from 'vitest';

import { elementsAsked } from './measure';
import { onlyOf, styleOf } from './measureValues';

import type { Measured } from './measureValues';

describe('what page measure is asked', () => {
  // A run's tester wrote the list `page play --read` takes, and was answered "No element a,b,c".
  it('takes a list of names written with commas apart, and a selector of CSS as one', () => {
    expect(elementsAsked(['board,activity,legend-area', 'totals'])).toEqual([
      'board',
      'activity',
      'legend-area',
      'totals'
    ]);
    expect(elementsAsked(['.card, .tile'])).toEqual(['.card, .tile']);
  });

  // A scout's line expected `padding-left=16px` from `--only padding-left`, was shown `padding`, and read "none".
  it('says a side of a box asked alone as itself, read off its shorthand', () => {
    const read = { styles: { padding: '8px 16px', color: 'red' } } as unknown as Measured;
    const only = onlyOf(read, ['padding-left', 'padding-top']);

    expect('problem' in only ? undefined : only.styles).toEqual({ 'padding-left': '16px', 'padding-top': '8px' });
    expect(styleOf({ padding: '8px 16px' }, 'padding-right')).toBe('16px');
    expect(styleOf({}, 'margin-left')).toBe('0px');
    expect(styleOf({}, 'overflow-x')).toBeUndefined();
  });
});
