import { createRenderer } from './draw.ts';
import { boundsOf, unionOf } from './geometry.ts';

import type { Palette } from './palette.ts';
import type { BoardElement } from '../../board/model.ts';

/** The whole drawing as a PNG, downloaded under the board's name — at up to twice its size, within 16 megapixels. */
export const exportPng = (elements: readonly BoardElement[], palette: Palette, title: string): void => {
  const box = unionOf(elements.map(boundsOf));
  if (!box) {
    return;
  }

  const margin = 32;
  const scale = Math.min(2, Math.sqrt(16_000_000 / ((box.width + margin * 2) * (box.height + margin * 2))));
  const image = document.createElement('canvas');
  image.width = Math.ceil((box.width + margin * 2) * scale);
  image.height = Math.ceil((box.height + margin * 2) * scale);
  const imageContext = image.getContext('2d');
  if (!imageContext) {
    return;
  }

  imageContext.fillStyle = palette.paper;
  imageContext.fillRect(0, 0, image.width, image.height);
  imageContext.setTransform(scale, 0, 0, scale, (margin - box.x) * scale, (margin - box.y) * scale);
  const imageRenderer = createRenderer(image);
  elements.forEach(element => imageRenderer.drawElement(imageContext, element, palette));
  image.toBlob(blob => {
    if (!blob) {
      return;
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(title || 'board').replace(/[^\w\- ]+/g, '').trim() || 'board'}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
};
