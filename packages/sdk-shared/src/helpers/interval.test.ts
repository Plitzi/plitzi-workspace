import { describe, expect, it } from 'vitest';

import { intervalOf, MIN_INTERVAL_MS } from './interval';

describe('intervalOf', () => {
  it('reads milliseconds as authoring writes them and as the builder’s field keeps them', () => {
    expect(intervalOf(5000)).toBe(5000);
    expect(intervalOf('5000')).toBe(5000);
  });

  it('refuses what cannot repeat: below the floor, a fraction, or not a number at all', () => {
    expect(intervalOf(MIN_INTERVAL_MS - 1)).toBeUndefined();
    expect(intervalOf(1500.5)).toBeUndefined();
    expect(intervalOf('soon')).toBeUndefined();
    expect(intervalOf('')).toBeUndefined();
    expect(intervalOf(undefined)).toBeUndefined();
  });
});
