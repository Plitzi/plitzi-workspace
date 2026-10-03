import { isDrawn } from './dom';

import type { QaFinding } from './dom';

/** Drawn this much bigger than the file, a picture reads soft. */
const UPSCALED = 1.25;

/** This much bigger than drawn, and this many pixels at least, a picture is bytes nobody sees. */
const OVERSIZED = 2.5;

const OVERSIZED_FROM = 800;

/**
 * Pictures whose file does not fit the box they are drawn in, at this screen's density: stretched past their pixels,
 * or several times larger than they are shown.
 */
export const findImageScale = (page: Element): QaFinding[] => {
  const density = page.ownerDocument.defaultView?.devicePixelRatio ?? 1;

  return [...page.querySelectorAll('img')].flatMap((image): QaFinding[] => {
    if (!image.complete || image.naturalWidth === 0 || !isDrawn(image)) {
      return [];
    }

    const drawn = image.getBoundingClientRect().width * density;
    if (drawn === 0) {
      return [];
    }

    if (image.naturalWidth * UPSCALED < drawn) {
      return [
        {
          check: 'images',
          element: image,
          note: `${String(image.naturalWidth)} px file drawn at ${String(Math.round(drawn))} px — soft`
        }
      ];
    }

    if (image.naturalWidth > drawn * OVERSIZED && image.naturalWidth >= OVERSIZED_FROM) {
      return [
        {
          check: 'images',
          element: image,
          note: `${String(image.naturalWidth)} px file for ${String(Math.round(drawn))} px`
        }
      ];
    }

    return [];
  });
};
