import { describe, expect, it } from 'vitest';

import { distancesBetween } from './measure';

describe('distancesBetween', () => {
  it('draws the gap between two boxes side by side, along the stretch they share', () => {
    expect(
      distancesBetween({ left: 0, top: 0, right: 100, bottom: 40 }, { left: 124, top: 10, right: 200, bottom: 60 })
    ).toEqual([{ x1: 100, y1: 25, x2: 124, y2: 25, length: 24 }]);
  });

  it('draws both gaps for a box that is off on both axes', () => {
    const lengths = distancesBetween(
      { left: 0, top: 0, right: 100, bottom: 40 },
      { left: 140, top: 72, right: 200, bottom: 100 }
    ).map(distance => distance.length);

    expect(lengths).toEqual([40, 32]);
  });

  it('draws the inner box’s distance to each side of the box that holds it', () => {
    const lengths = distancesBetween(
      { left: 20, top: 16, right: 80, bottom: 44 },
      { left: 0, top: 0, right: 100, bottom: 60 }
    ).map(distance => distance.length);

    expect(lengths).toEqual([16, 20, 16, 20]);
  });
});
