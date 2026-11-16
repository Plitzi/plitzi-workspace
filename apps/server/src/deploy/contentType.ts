/** The media types a site's files are served as, by extension: what a static host is told for each upload. */
const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  webmanifest: 'application/manifest+json',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm'
};

/** A file's media type from its path; one this list does not know is served as bytes, never guessed as a page. */
export const contentTypeOf = (path: string): string => {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();

  return TYPES[extension] ?? 'application/octet-stream';
};
