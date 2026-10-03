import { describe, expect, it } from 'vitest';

import { IMAGE_PATH, imageSrcSet, imageUrl, isImageWidth, isRemoteImage } from './images';

describe('images', () => {
  it('addresses a remote picture at one of the widths the server makes', () => {
    expect(imageUrl(IMAGE_PATH, 'https://cdn.example.com/a b.jpg', 640)).toBe(
      '/_plitzi/img?url=https%3A%2F%2Fcdn.example.com%2Fa%20b.jpg&w=640'
    );
    expect(imageSrcSet(IMAGE_PATH, 'https://x.test/p.png').split(', ')).toHaveLength(8);
    expect(isImageWidth(640)).toBe(true);
    expect(isImageWidth(641)).toBe(false);
  });

  it('resizes only what another site serves', () => {
    expect(isRemoteImage('https://x.test/p.png')).toBe(true);
    expect(isRemoteImage('/hero.jpg')).toBe(false);
    expect(isRemoteImage('data:image/png;base64,AA')).toBe(false);
  });
});
