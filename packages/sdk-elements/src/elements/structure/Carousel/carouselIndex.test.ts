import { describe, expect, it } from 'vitest';

import { clampIndex, directionOf, stepIndex } from './carouselIndex';

describe('carousel positions', () => {
  it('goes round the ends when it loops, and stops at them when it does not', () => {
    expect(stepIndex(3, 4, 1, true)).toBe(0);
    expect(stepIndex(0, 4, -1, true)).toBe(3);
    expect(stepIndex(3, 4, 1, false)).toBe(3);
    expect(stepIndex(0, 4, -1, false)).toBe(0);
    expect(stepIndex(0, 0, 1, true)).toBe(0);
  });

  it('takes a requested slide as one it has', () => {
    expect(clampIndex('2', 4)).toBe(2);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(-1, 4)).toBe(0);
    expect(clampIndex('next', 4)).toBe(0);
  });

  it('says which way a jump goes', () => {
    expect(directionOf(3, 1)).toBe('previous');
    expect(directionOf(1, 3)).toBe('next');
  });
});
