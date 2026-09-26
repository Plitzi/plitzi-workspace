import { COLLAB_COLOURS } from '../../board/people.ts';
import { FILLS, STROKES } from '../../board/model.ts';

import type { Fill, Stroke } from '../../board/model.ts';

/**
 * The colours the canvas paints with, read from the page.
 *
 * The canvas ships none: every name a board stores (`ink`, `red`) is a `--board-*` custom property on the element,
 * which the space points at its own tokens. Read again whenever the scheme changes, so a board recolours with the
 * page around it.
 */
export type Palette = {
  /** What changes whenever any colour does: the drawings cached under the old palette are stale. */
  key: string;
  stroke: Record<Stroke, string>;
  fill: Record<Fill, string>;
  /** A sticky note's paper, by the same names as the fills. */
  sticky: Record<Fill, string>;
  collab: Record<string, string>;
  paper: string;
  dots: string;
  accent: string;
  /** The hand-drawn face, as a canvas font family. */
  font: string;
  /** The interface's face: the names on the cursors. */
  ui: string;
};

const read = (style: CSSStyleDeclaration, name: string, fallback: string): string =>
  style.getPropertyValue(name).trim() || fallback;

// `fromEntries` answers a string-keyed record; every key of `keys` is in it, which the type cannot follow.
const table = <K extends string>(keys: readonly K[], value: (key: K) => string): Record<K, string> =>
  Object.fromEntries(keys.map(key => [key, value(key)])) as Record<K, string>;

export const readPalette = (element: HTMLElement): Palette => {
  const style = getComputedStyle(element);
  const ink = read(style, '--board-ink', '#1e1e1e');
  const palette = {
    stroke: table(STROKES, name => read(style, `--board-${name}`, ink)),
    fill: table(FILLS, name => (name === 'none' ? 'transparent' : read(style, `--board-fill-${name}`, ink))),
    sticky: table(FILLS, name => read(style, `--board-sticky-${name === 'none' ? 'yellow' : name}`, '#ffec99')),
    collab: table(COLLAB_COLOURS, name => read(style, `--collab-${name}`, ink)),
    paper: read(style, '--board-paper', '#ffffff'),
    dots: read(style, '--board-dots', 'rgba(0, 0, 0, 0.12)'),
    accent: read(style, '--board-accent', '#4c6ef5'),
    font: read(style, '--board-font', 'cursive'),
    ui: read(style, '--board-ui-font', 'system-ui, sans-serif')
  };

  return { ...palette, key: JSON.stringify(palette) };
};
