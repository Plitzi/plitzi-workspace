import { describe, expect, it } from 'vitest';

import { LAYOUT_GRIDS, layoutGridCss, layoutGridLook } from './layoutGrid';

describe('layoutGrid', () => {
  it('draws twelve columns wide, eight from a tablet down and four on a phone, at the page’s own breakpoints', () => {
    const css = layoutGridCss();

    expect(css).toContain('min(1200px, calc(100% - 64px))');
    expect(css).toContain('calc((100% - 264px) / 12)');
    expect(css).toMatch(/@media \(max-width: 64rem\) \{ html::after \{ width: calc\(100% - 48px\);[^}]*\/ 8\)/);
    expect(css).toMatch(/@media \(max-width: 48rem\) \{ html::after \{ width: calc\(100% - 32px\);[^}]*\/ 4\)/);
  });

  it('scales every length with a zoom the grid’s box is not inside', () => {
    const look = layoutGridLook(LAYOUT_GRIDS.desktop, 0.5);

    expect(look.width).toBe('min(600px, calc(100% - 32px))');
    expect(look.backgroundImage).toContain('calc((100% - 132px) / 12)');
    expect(look.backgroundImage).toContain('+ 12px)');
  });

  it('keeps each grid’s gutters and margins inside the narrowest page it is drawn on', () => {
    for (const [mode, { columns, gutter, margin }] of Object.entries(LAYOUT_GRIDS)) {
      expect(gutter * (columns - 1) + margin * 2, mode).toBeLessThan(mode === 'mobile' ? 320 : 768);
    }
  });
});
