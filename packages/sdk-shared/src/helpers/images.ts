/**
 * A remote picture resized by the server that renders the page — the one vocabulary both ends speak.
 *
 * The widths are a closed set rather than whatever a page asks for: each one is a file the server makes and keeps,
 * so a free width would let anybody fill its disk one request at a time.
 */

/** Where a page server that resizes images answers. */
export const IMAGE_PATH = '/_plitzi/img';

/** Every width a picture is offered at, narrowest first. */
export const IMAGE_WIDTHS = [320, 480, 640, 768, 960, 1280, 1600, 1920] as const;

export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

export const isImageWidth = (width: number): width is ImageWidth => IMAGE_WIDTHS.some(known => known === width);

/** A picture another site serves — the only kind there is anything to resize; a path of this site is served as it is. */
export const isRemoteImage = (src: string): boolean => /^https?:\/\//i.test(src);

/** The address of `src` at `width` on the endpoint. */
export const imageUrl = (endpoint: string, src: string, width: ImageWidth): string =>
  `${endpoint}?url=${encodeURIComponent(src)}&w=${String(width)}`;

/** Every width as a `srcset`, for the browser to pick the one its layout needs. */
export const imageSrcSet = (endpoint: string, src: string): string =>
  IMAGE_WIDTHS.map(width => `${imageUrl(endpoint, src, width)} ${String(width)}w`).join(', ');
