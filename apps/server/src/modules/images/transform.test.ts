import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { loadSharpTransform } from './transform';

/** A plain picture `width` × `height` in PNG, made by the same library the transform drives. */
const png = (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#4f46e5' } })
    .png()
    .toBuffer();

describe('the sharp transform', () => {
  it('shrinks a picture to the width asked, in the format asked, and never enlarges one', async () => {
    const transform = await loadSharpTransform();
    if (!transform) {
      throw new Error('sharp is a dev dependency of this package, so it loads here');
    }

    const smaller = await transform(await png(800, 400), 320, 'webp');
    const kept = await transform(await png(64, 32), 320, 'avif');

    expect(await sharp(smaller).metadata()).toMatchObject({ format: 'webp', width: 320, height: 160 });
    expect(await sharp(kept).metadata()).toMatchObject({ format: 'heif', width: 64 });
  });
});
