import { describe, expect, it } from 'vitest';

import { cropped } from './crop';
import { pixelsOf } from '../drawn';
import { pngOf } from '../tests/png';

// A script's part is cut out of the screen it pictured once, where it waited seconds for its own picture.
describe('a part cut out of a screen', () => {
  it('is the box, in the picture’s own pixels — a screen at twice its CSS size — kept inside the picture', () => {
    // 8×6 device pixels for a 4×3 screen: each pixel's red is its x, its green its y.
    const screen = pngOf(8, 6, (x, y) => [x, y, 0, 255], 1);
    const part = pixelsOf(cropped(screen, { x: 1, y: 1, width: 2, height: 1 }, 4));

    expect([part.width, part.height]).toEqual([4, 2]);
    expect(Array.from(part.rgba.subarray(0, 4))).toEqual([2, 2, 0, 255]);
    expect(Array.from(part.rgba.subarray(-4))).toEqual([5, 3, 0, 255]);
    expect(pixelsOf(cropped(screen, { x: 3, y: 2, width: 10, height: 10 }, 4))).toMatchObject({ width: 2, height: 2 });
  });
});
