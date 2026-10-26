import { writeFile } from 'node:fs/promises';

import type { BrowserPage } from '../../browser';

/**
 * Where a picture is written: its file's name, and a tall page's parts beside it.
 */

/** A whole page taller than this many screens is pictured in parts too (`ShotReport.tiles`). */
const TILED_SCREENS = 3;

/** A part's height, in screens: some of the screen before it in each, so nothing is cut at an edge unseen. */
const TILE_SCREENS = 1.5;

/** The whole page in parts, each written beside the picture as `<base>-part-<n>.png` — none when it is short. */
export const tilesOf = async (
  page: BrowserPage,
  view: { width: number; height: number },
  base: string
): Promise<string[]> => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight, undefined);
  if (height <= view.height * TILED_SCREENS) {
    return [];
  }

  const tall = Math.round(view.height * TILE_SCREENS);
  const step = view.height;
  const files: string[] = [];
  for (let top = 0; top < height; top += step) {
    const file = `${base}-part-${String(files.length + 1)}.png`;
    const clip = { x: 0, y: top, width: view.width, height: Math.min(tall, height - top) };
    await writeFile(file, await page.screenshot({ fullPage: true, clip }));
    files.push(file);
    if (top + tall >= height) {
      break;
    }
  }

  return files;
};

const slug = (text: string): string => text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

/**
 * A picture's file: the page, the part clipped, the width and the theme it was painted in — the space's default when
 * none was asked for. A part is in the name: two clips of one page wrote one file, the second over the first.
 */
export const shotFile = (pathname: string, clip: string | undefined, width: number, scheme: string): string =>
  `${pathname === '/' ? 'home' : slug(pathname)}${clip === undefined ? '' : `-${slug(clip)}`}-${String(width)}-${scheme}.png`;

/**
 * The file `--out` names for one of several pictures: the name given, with what tells this one from the others — its
 * page when there are several, its width, its scheme — so one never writes over another.
 */
export const eachOut = (
  out: string,
  each: { route: string | undefined; width: number; scheme?: string },
  asked: { pages: number; widths: number; schemes: number }
): string => {
  const named = [
    ...(asked.pages > 1 ? [each.route === undefined || each.route === '/' ? 'home' : slug(each.route)] : []),
    ...(asked.widths > 1 ? [String(each.width)] : []),
    ...(each.scheme !== undefined && asked.schemes > 1 ? [each.scheme] : [])
  ].join('-');

  return out.replace(/(\.png)?$/, `-${named}.png`);
};

/** A picture shorter than a few lines of text, said by its size: `350×26 px`. */
export const smallPicture = (png: Uint8Array): string | undefined => {
  if (png.length < 24) {
    return undefined;
  }

  const view = new DataView(png.buffer, png.byteOffset);
  const [width, height] = [view.getUint32(16), view.getUint32(20)];

  return height < 64 ? `${String(width)}×${String(height)} px` : undefined;
};

/** Whether a region of a comparison is the section asked: its name, its element's id, or its element. */
export const matchesSection = (region: { name: string; element?: string }, section: string): boolean =>
  region.name === section || region.name.endsWith(`#${section}`) || region.element === section;
