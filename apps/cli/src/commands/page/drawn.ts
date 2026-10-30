import { inflateSync } from 'node:zlib';

import { DRAWN } from './measureValues';

import type { BrowserPage } from '../../browser';

/**
 * What an element draws, read off a picture of it: the bounds of the pixels unlike its background — a map canvas's
 * globe, a chart's plot. A run's designer and tester each decoded a screenshot with a script of their own to hold a
 * globe's drawn size; `page measure <element> --only drawn` reads it, `--expect drawn-width>=340px` holds it.
 */

/** A picture as its pixels: four bytes each, red, green, blue and alpha, a row after another. */
export interface Pixels {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** How far a pixel's channels may stray from the background's, summed, and still be background: anti-aliasing's. */
const LIKE_BACKGROUND = 48;

/** What a screenshot's picture is written as by a browser: eight bits a channel, colour or colour with alpha. */
const CHANNELS: Readonly<Record<number, number>> = { 2: 3, 6: 4 };

const paeth = (left: number, up: number, upLeft: number): number => {
  const guess = left + up - upLeft;
  const [toLeft, toUp, toUpLeft] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - upLeft)];

  return toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft;
};

/** A browser screenshot's PNG as its pixels — refused, said, for any other kind of PNG (paletted, 16-bit, interlaced). */
export const pixelsOf = (png: Uint8Array): Pixels => {
  const bytes = Buffer.from(png);
  let at = 8;
  let header: { width: number; height: number; depth: number; colour: number; interlaced: boolean } | undefined;
  const data: Buffer[] = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const kind = bytes.toString('ascii', at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colour: body[9],
        interlaced: body[12] !== 0
      };
    } else if (kind === 'IDAT') {
      data.push(body);
    }

    at += length + 12;
  }

  const channels = header ? CHANNELS[header.colour] : undefined;
  if (!header || channels === undefined || header.depth !== 8 || header.interlaced) {
    throw new Error('Not a picture a browser takes: an 8-bit RGB or RGBA PNG, not interlaced');
  }

  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? rows[y * stride + x - channels] : 0;
      const up = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0;
      const value = raw[y * (stride + 1) + 1 + x];
      const predicted =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0;
      rows[y * stride + x] = (value + predicted) & 255;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgba.set(rows.subarray(pixel * channels, pixel * channels + 3), pixel * 4);
    rgba[pixel * 4 + 3] = channels === 4 ? rows[pixel * channels + 3] : 255;
  }

  return { width, height, rgba };
};

/**
 * The box of the pixels unlike the picture's background — the colour most of its edge has — or none when it draws
 * nothing on it.
 */
export const drawnBounds = ({
  width,
  height,
  rgba
}: Pixels): { x: number; y: number; width: number; height: number } | undefined => {
  const colourAt = (x: number, y: number): [number, number, number] => {
    const at = (y * width + x) * 4;

    return [rgba[at], rgba[at + 1], rgba[at + 2]];
  };
  const counted = new Map<string, { colour: [number, number, number]; count: number }>();
  const count = (x: number, y: number): void => {
    const colour = colourAt(x, y);
    const key = colour.join(',');
    const seen = counted.get(key);
    counted.set(key, { colour, count: (seen?.count ?? 0) + 1 });
  };
  for (let x = 0; x < width; x += 1) {
    count(x, 0);
    count(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    count(0, y);
    count(width - 1, y);
  }

  const background = [...counted.values()].sort((a, b) => b.count - a.count).at(0)?.colour;
  if (!background) {
    return undefined;
  }

  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const colour = colourAt(x, y);
      const apart =
        Math.abs(colour[0] - background[0]) + Math.abs(colour[1] - background[1]) + Math.abs(colour[2] - background[2]);
      if (apart > LIKE_BACKGROUND) {
        [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
      }
    }
  }

  return right < 0 ? undefined : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

/** The id of the style that hides the rest of the page for the moment an element is pictured alone. */
const ALONE = 'plitzi-measured-alone';

/**
 * What `selector` draws, as `DRAWN` reads it, in the page's px — `drawn-y` counts what is scrolled: a picture of the
 * element alone, everything else on the page hidden for that moment so what lies over it (a HUD over a map) is not read
 * as its own. `none` when it draws nothing unlike its background.
 */
export const drawnOn = async (page: BrowserPage, selector: string): Promise<Record<string, string>> => {
  const box = await page.evaluate(
    ({ selector: asked, id }: { selector: string; id: string }) => {
      // The first one shown, as `measureOn` names it when an earlier match is hidden: `… >> nth=2`.
      const [css, nth = '0'] = asked.split(' >> nth=');
      const node = Array.from(document.querySelectorAll(css)).at(Number(nth));
      if (!node) {
        return undefined;
      }

      node.setAttribute(`data-${id}`, '');
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `body * { visibility: hidden !important; } [data-${id}], [data-${id}] * { visibility: visible !important; }`;
      document.head.append(style);
      const placed = node.getBoundingClientRect();

      return { x: placed.left, y: placed.top, width: placed.width, height: placed.height, scrolled: window.scrollY };
    },
    { selector, id: ALONE }
  );
  try {
    const shown =
      box && box.width >= 1 && box.height >= 1
        ? drawnBounds(
            pixelsOf(
              await page.screenshot({
                fullPage: false,
                clip: { x: box.x, y: box.y, width: box.width, height: box.height },
                scale: 'css'
              })
            )
          )
        : undefined;

    return Object.fromEntries(
      DRAWN.map((name, index) => {
        if (!box || !shown) {
          return [name, 'none'];
        }

        const value = [box.x + shown.x, box.y + box.scrolled + shown.y, shown.width, shown.height][index] ?? 0;

        return [name, `${String(Math.round(value))}px`];
      })
    );
  } finally {
    await page.evaluate((id: string) => {
      document.getElementById(id)?.remove();
      document.querySelector(`[data-${id}]`)?.removeAttribute(`data-${id}`);
    }, ALONE);
  }
};
