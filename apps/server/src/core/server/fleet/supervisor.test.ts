import { describe, expect, it } from 'vitest';

import { restartDelay } from './supervisor';

describe('restartDelay', () => {
  it('replaces at once as many deaths a minute as there are workers', () => {
    expect([1, 2, 3, 4].map(deaths => restartDelay(deaths, 4))).toEqual([0, 0, 0, 0]);
  });

  it('waits longer for each death past that, doubling from half a second', () => {
    expect([5, 6, 7, 8].map(deaths => restartDelay(deaths, 4))).toEqual([500, 1_000, 2_000, 4_000]);
  });

  it('never waits more than thirty seconds', () => {
    expect(restartDelay(20, 4)).toBe(30_000);
    expect(restartDelay(1_000, 1)).toBe(30_000);
  });
});
