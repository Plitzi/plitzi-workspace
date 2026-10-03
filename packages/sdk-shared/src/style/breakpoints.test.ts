import { describe, expect, it } from 'vitest';

import { DISPLAY_MODE_MIN_WIDTH, displayModeAt, displayModeWidthRem } from './breakpoints';

describe('breakpoints', () => {
  it('names the display mode whose rules a width shows, the narrower winning where two meet', () => {
    expect(displayModeAt(1440)).toBe('desktop');
    expect(displayModeAt(1025)).toBe('desktop');
    expect(displayModeAt(1024)).toBe('tablet');
    expect(displayModeAt(769)).toBe('tablet');
    expect(displayModeAt(768)).toBe('mobile');
    expect(displayModeAt(390)).toBe('mobile');
  });

  it('writes each width in rem, as the compiled media queries do', () => {
    expect(displayModeWidthRem('desktop')).toBe('64rem');
    expect(displayModeWidthRem('tablet')).toBe('48rem');
    expect(displayModeWidthRem('mobile')).toBe('0');
    expect(DISPLAY_MODE_MIN_WIDTH.desktop).toBeGreaterThan(DISPLAY_MODE_MIN_WIDTH.tablet);
  });
});
