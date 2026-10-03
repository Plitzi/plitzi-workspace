/**
 * The layout grid the canvas draws on request: the columns a page is usually laid out on, at the frame's width — twelve
 * on a desktop, eight on a tablet, four on a phone — so an element can be lined up by eye with the rest of the page.
 *
 * Drawn inside the canvas frame, over the page and through to it (`pointer-events: none`), and fixed to the frame's
 * viewport like a design tool's grid: it stays put while the page scrolls under it. The canvas is zoomed by a `zoom`
 * on the element that holds the page, which a fixed layer of the frame does not see, so every length here is scaled by
 * the same factor.
 */

export interface LayoutGrid {
  /** The narrowest frame this grid is drawn at, in CSS pixels. */
  minWidth: number;
  columns: number;
  gutter: number;
  /** Clear on each side of the columns. */
  margin: number;
  /** The widest the columns get together; the margins grow past it. */
  maxWidth?: number;
}

export const LAYOUT_GRIDS: LayoutGrid[] = [
  { minWidth: 1024, columns: 12, gutter: 24, margin: 32, maxWidth: 1200 },
  { minWidth: 768, columns: 8, gutter: 20, margin: 24 },
  { minWidth: 0, columns: 4, gutter: 16, margin: 16 }
];

const COLUMN = 'rgba(91, 61, 245, 0.07)';

const EDGE = 'rgba(91, 61, 245, 0.32)';

const px = (value: number, zoom: number): string => `${String(value * zoom)}px`;

const rulesOf = ({ columns, gutter, margin, maxWidth }: LayoutGrid, zoom: number): string => {
  const room = `calc(100% - ${px(margin * 2, zoom)})`;
  const column = `calc((100% - ${px(gutter * (columns - 1), zoom)}) / ${String(columns)})`;

  return [
    `width: ${maxWidth === undefined ? room : `min(${px(maxWidth, zoom)}, ${room})`};`,
    `background-image: repeating-linear-gradient(to right, ${COLUMN} 0px, ${COLUMN} ${column}, transparent ${column}, transparent calc(${column} + ${px(gutter, zoom)}));`
  ].join(' ');
};

/** The grid's rules for the canvas frame at a zoom, the narrower grids taking over below each one's width. */
export const layoutGridCss = (zoom = 1): string => {
  const [widest, ...narrower] = LAYOUT_GRIDS;

  return [
    `html::after { content: ''; position: fixed; top: 0; bottom: 0; left: 50%; z-index: 2147483000; transform: translateX(-50%); pointer-events: none; box-shadow: inset 1px 0 ${EDGE}, inset -1px 0 ${EDGE}; ${rulesOf(widest, zoom)} }`,
    ...narrower.map(
      (grid, index) =>
        `@media (max-width: ${String(LAYOUT_GRIDS[index].minWidth - 0.02)}px) { html::after { ${rulesOf(grid, zoom)} } }`
    )
  ].join('\n');
};
