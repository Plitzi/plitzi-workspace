import { crc32, deflateSync } from 'node:zlib';

import { pixelsOf } from '../drawn';

import type { Pixels } from '../drawn';

/**
 * A part of a picture cut out of it, here rather than taken again: a `--steps` script pictures the screen once a step and
 * its part is cut from that — a part's own picture waited for its box to be still, and at `--scale 3` each picture of a
 * page drawing a globe took seconds more, the waits written 300 ms apart coming out 8 s apart (a run's designer).
 */

/** Where a part is on the screen, in CSS pixels. */
export interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const chunk = (kind: string, body: Buffer): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'ascii');
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind, 'ascii'), body])), 0);

  return Buffer.concat([head, body, sum]);
};

/** Pixels written as a PNG: eight bits a channel, colour and alpha, each row unfiltered. */
export const pngOf = ({ width, height, rgba }: Pixels): Uint8Array => {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

/**
 * The part of a screen's picture a box covers — the box in CSS pixels, the picture in device pixels (`--scale`), told
 * apart by `cssWidth`, the screen's width — kept inside the picture.
 */
export const cropped = (screen: Uint8Array, box: ScreenBox, cssWidth: number): Uint8Array => {
  const whole = pixelsOf(screen);
  const scale = whole.width / cssWidth;
  const left = Math.max(0, Math.round(box.x * scale));
  const top = Math.max(0, Math.round(box.y * scale));
  const width = Math.max(1, Math.min(whole.width, Math.round((box.x + box.width) * scale)) - left);
  const height = Math.max(1, Math.min(whole.height, Math.round((box.y + box.height) * scale)) - top);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((top + y) * whole.width + left) * 4;
    rgba.set(whole.rgba.subarray(from, from + width * 4), y * width * 4);
  }

  return pngOf({ width, height, rgba });
};
