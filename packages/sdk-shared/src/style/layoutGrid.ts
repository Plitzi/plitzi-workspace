import { displayModeWidthRem } from './breakpoints';

import type { DisplayMode } from '../types';

/**
 * The layout grid drawn over a page on request: the columns it is usually laid out on — twelve on a desktop, eight on
 * a tablet, four on a phone — so an element can be lined up by eye with the rest of it. The builder draws it over its
 * canvas, the dev tools over a running page; both read it from here.
 */

export interface LayoutGrid {
  columns: number;
  gutter: number;
  /** Clear on each side of the columns. */
  margin: number;
  /** The widest the columns get together; the margins grow past it. */
  maxWidth?: number;
}

export const LAYOUT_GRIDS: Record<DisplayMode, LayoutGrid> = {
  desktop: { columns: 12, gutter: 24, margin: 32, maxWidth: 1200 },
  tablet: { columns: 8, gutter: 20, margin: 24 },
  mobile: { columns: 4, gutter: 16, margin: 16 }
};

const COLUMN = 'rgba(91, 61, 245, 0.07)';

const EDGE = 'rgba(91, 61, 245, 0.32)';

const px = (value: number, zoom: number): string => `${String(value * zoom)}px`;

export interface LayoutGridLook {
  width: string;
  backgroundImage: string;
  boxShadow: string;
}

/**
 * How a grid is drawn on a box as wide as the page and centred in it: its width, its columns as a gradient, its edges.
 * `zoom` scales every length, for a page drawn zoomed by an element the grid's box is not inside.
 */
export const layoutGridLook = ({ columns, gutter, margin, maxWidth }: LayoutGrid, zoom = 1): LayoutGridLook => {
  const room = `calc(100% - ${px(margin * 2, zoom)})`;
  const column = `calc((100% - ${px(gutter * (columns - 1), zoom)}) / ${String(columns)})`;

  return {
    width: maxWidth === undefined ? room : `min(${px(maxWidth, zoom)}, ${room})`,
    backgroundImage: `repeating-linear-gradient(to right, ${COLUMN} 0px, ${COLUMN} ${column}, transparent ${column}, transparent calc(${column} + ${px(gutter, zoom)}))`,
    boxShadow: `inset 1px 0 ${EDGE}, inset -1px 0 ${EDGE}`
  };
};

const declarations = (look: LayoutGridLook): string =>
  `width: ${look.width}; background-image: ${look.backgroundImage};`;

/**
 * The grid as rules for a document of its own — the builder's canvas frame: fixed to its viewport and through to the
 * page, the tablet's and the phone's taking over at the widths the page's own breakpoints switch at.
 */
export const layoutGridCss = (zoom = 1): string =>
  [
    `html::after { content: ''; position: fixed; top: 0; bottom: 0; left: 50%; z-index: 2147483000; transform: translateX(-50%); pointer-events: none; box-shadow: ${layoutGridLook(LAYOUT_GRIDS.desktop, zoom).boxShadow}; ${declarations(layoutGridLook(LAYOUT_GRIDS.desktop, zoom))} }`,
    `@media (max-width: ${displayModeWidthRem('desktop')}) { html::after { ${declarations(layoutGridLook(LAYOUT_GRIDS.tablet, zoom))} } }`,
    `@media (max-width: ${displayModeWidthRem('tablet')}) { html::after { ${declarations(layoutGridLook(LAYOUT_GRIDS.mobile, zoom))} } }`
  ].join('\n');
