import type { DisplayMode } from '../types';

/**
 * Where each display mode begins, in CSS pixels — the widths a style's breakpoints are compiled at (`sdk-style`'s
 * `generateCache`). A desktop's rules are the base; a tablet's apply up to and including 1024px and a phone's up to
 * and including 768px, the phone's winning where the two meet.
 */
export const DISPLAY_MODE_MIN_WIDTH: Record<DisplayMode, number> = { desktop: 1024, tablet: 768, mobile: 0 };

/** The same width as a media query writes it: in rem at the browser's default 16px, so it follows a visitor's zoom. */
export const displayModeWidthRem = (mode: DisplayMode): string =>
  DISPLAY_MODE_MIN_WIDTH[mode] === 0 ? '0' : `${String(DISPLAY_MODE_MIN_WIDTH[mode] / 16)}rem`;

/** The display mode whose rules a page shows at a viewport width. */
export const displayModeAt = (width: number): DisplayMode => {
  if (width <= DISPLAY_MODE_MIN_WIDTH.tablet) {
    return 'mobile';
  }

  return width <= DISPLAY_MODE_MIN_WIDTH.desktop ? 'tablet' : 'desktop';
};
