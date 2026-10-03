// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { contrastRatio, isLargeText, over, toHex, toRgba } from './colour';

describe('colour', () => {
  it('reads the colours a computed style gives, where nothing can paint one', () => {
    expect(toRgba('rgb(91, 61, 245)')).toEqual([91, 61, 245, 1]);
    expect(toRgba('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
    expect(toRgba('#fff')).toEqual([255, 255, 255, 1]);
    expect(toRgba('transparent')).toEqual([0, 0, 0, 0]);
  });

  it('lays a translucent colour over another, and measures WCAG contrast', () => {
    expect(over([0, 0, 0, 0.5], [255, 255, 255, 1]).map(Math.round)).toEqual([128, 128, 128, 1]);
    expect(contrastRatio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21);
    expect(contrastRatio([255, 255, 255, 1], [255, 255, 255, 1])).toBe(1);
    expect(toHex([91, 61, 245, 1])).toBe('#5b3df5');
    expect(toHex([0, 0, 0, 0.4])).toBe('#000000 · 40%');
  });

  it('calls text large from 24 px, or 18.66 px in bold', () => {
    expect([isLargeText(24, 400), isLargeText(19, 700), isLargeText(19, 400), isLargeText(16, 800)]).toEqual([
      true,
      true,
      false,
      false
    ]);
  });
});
