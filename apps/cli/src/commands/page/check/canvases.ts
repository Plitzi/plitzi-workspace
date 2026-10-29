import { dataUrl } from '../../../browser';

import type { BrowserPage } from '../../../browser';

/**
 * A canvas painted one colour — a map, a chart drawing nothing but its ground: what it draws is pictures, never read
 * as the page's words, so a run's look said "nothing wrong" of a globe painted solid orange edge to edge. Said, failing
 * nothing — an empty chart may be one colour on purpose.
 */

/** How many canvases of a page are looked at: the largest first. */
const CANVASES_READ = 4;

/** Runs in the page: each canvas worth looking at — in view, 120 px each way or more — its element and its box. */
export const canvasesInPage = (): { id: string; x: number; y: number; width: number; height: number }[] =>
  Array.from(document.querySelectorAll('canvas'))
    .map(canvas => {
      const box = canvas.getBoundingClientRect();
      const left = Math.max(box.left, 0);
      const top = Math.max(box.top, 0);

      return {
        id:
          canvas.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el') ??
          canvas.closest('[data-plitzi-instance]')?.getAttribute('data-plitzi-instance') ??
          'canvas',
        x: left + window.scrollX,
        y: top + window.scrollY,
        width: Math.min(box.right, window.innerWidth) - left,
        height: Math.min(box.bottom, window.innerHeight) - top
      };
    })
    .filter(each => each.width >= 120 && each.height >= 120)
    .sort((a, b) => b.width * b.height - a.width * a.height);

/**
 * Runs in the page: the one colour a picture is painted, as `#rrggbb` — its pixels on a grid, none further than a few
 * levels from the first — or nothing when it draws more than one.
 */
export const oneColourIn = async (picture: string): Promise<string | undefined> => {
  const image = new Image();
  image.src = picture;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context || canvas.width === 0 || canvas.height === 0) {
    return undefined;
  }

  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const at = (x: number, y: number): number[] => {
    const offset = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;

    return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
  };
  const [r = 0, g = 0, b = 0] = at(canvas.width / 2, canvas.height / 2);
  for (let row = 0; row < 16; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      const [pr = 0, pg = 0, pb = 0] = at(((column + 0.5) * canvas.width) / 16, ((row + 0.5) * canvas.height) / 16);
      if (Math.abs(pr - r) > 6 || Math.abs(pg - g) > 6 || Math.abs(pb - b) > 6) {
        return undefined;
      }
    }
  }

  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
};

/** The canvases of the page painted one colour, each with it, as a check says them. */
export const oneColourCanvases = async (page: BrowserPage): Promise<{ id: string; colour: string }[]> => {
  const found: { id: string; colour: string }[] = [];
  for (const { id, ...clip } of (await page.evaluate(canvasesInPage, undefined)).slice(0, CANVASES_READ)) {
    const picture = await page.screenshot({ fullPage: true, clip });
    const colour = await page.evaluate(oneColourIn, dataUrl(picture));
    if (colour !== undefined) {
      found.push({ id, colour });
    }
  }

  return found;
};
