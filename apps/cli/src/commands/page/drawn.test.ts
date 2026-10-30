import { describe, expect, it } from 'vitest';

import { drawnBounds, pixelsOf } from './drawn';
import { pngOf } from './tests/png';

/** A dark field with a light disc of radius 6 centred at (14, 10) — the globe on a map's canvas, small. */
const globe = (x: number, y: number): number[] =>
  (x - 14) ** 2 + (y - 10) ** 2 <= 36 ? [120, 200, 230, 255] : [12, 20, 28, 255];

describe('what an element draws', () => {
  it('is the box of the pixels unlike its background, whichever way its rows were written', () => {
    for (const filter of [0, 1, 2]) {
      expect(drawnBounds(pixelsOf(pngOf(30, 22, globe, filter)))).toEqual({ x: 8, y: 4, width: 13, height: 13 });
    }
  });

  it('is nothing on a picture of its background alone', () => {
    expect(drawnBounds(pixelsOf(pngOf(10, 10, () => [12, 20, 28, 255])))).toBeUndefined();
  });

  it('refuses a PNG no browser takes, said', () => {
    const paletted = pngOf(2, 2, () => [0, 0, 0, 255]);
    // The header's colour type, at its fixed place: 3, a palette.
    paletted[25] = 3;

    expect(() => pixelsOf(paletted)).toThrow('Not a picture a browser takes');
  });
});
