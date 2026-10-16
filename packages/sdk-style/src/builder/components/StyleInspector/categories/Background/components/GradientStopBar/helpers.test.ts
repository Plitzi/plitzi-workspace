import { describe, expect, it } from 'vitest';

import { colorNear, sortStops, stopPct, stopsPreview } from './helpers';

const stop = (id: string, color: string, position: string) => ({ id, color, position });

describe('gradient stops', () => {
  it('places a stop by its first position, within the bar', () => {
    expect(stopPct('25%')).toBe(25);
    expect(stopPct('10% 20%')).toBe(10);
    expect(stopPct('')).toBe(0);
    expect(stopPct('140%')).toBe(100);
  });

  it('sorts the stops left to right', () => {
    expect(sortStops([stop('b', 'blue', '80%'), stop('a', 'red', '10%')]).map(s => s.id)).toEqual(['a', 'b']);
  });

  it('draws the stops left to right on the bar', () => {
    expect(stopsPreview([stop('b', 'blue', '100%'), stop('a', 'red', '0%')])).toBe(
      'linear-gradient(90deg, red 0%, blue 100%)'
    );
  });

  it('gives a new stop the color of the closest one', () => {
    expect(colorNear([stop('a', 'red', '0%'), stop('b', 'blue', '100%')], 70)).toBe('blue');
  });
});
