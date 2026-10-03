import { describe, expect, it } from 'vitest';

import { LAYOUT_GRIDS, layoutGridCss } from './layoutGrid';

describe('layoutGridCss', () => {
  it('draws twelve columns wide, eight below a desktop and four below a tablet', () => {
    const css = layoutGridCss();

    expect(css).toContain('min(1200px, calc(100% - 64px))');
    expect(css).toContain('calc((100% - 264px) / 12)');
    expect(css).toMatch(/@media \(max-width: 1023\.98px\) \{ html::after \{ width: calc\(100% - 48px\);[^}]*\/ 8\)/);
    expect(css).toMatch(/@media \(max-width: 767\.98px\) \{ html::after \{ width: calc\(100% - 32px\);[^}]*\/ 4\)/);
  });

  it('scales every length with the canvas zoom, which the frame’s fixed layer does not see', () => {
    const css = layoutGridCss(0.5);

    expect(css).toContain('min(600px, calc(100% - 32px))');
    expect(css).toContain('calc((100% - 132px) / 12)');
    expect(css).toContain('+ 12px)');
  });

  it('keeps each grid’s gutters inside the room its margins leave', () => {
    for (const { columns, gutter, margin, minWidth } of LAYOUT_GRIDS) {
      expect(gutter * (columns - 1) + margin * 2).toBeLessThan(Math.max(minWidth, 360));
    }
  });
});
