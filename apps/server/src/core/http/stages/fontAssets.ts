import { serveStatic } from '../../staticFiles';

import type { Stage } from '../types';
import type { SSRRequest } from '@plitzi/sdk-shared';

/** Where a manifest's `hosted` paths are addressed from by default — see `fontUrlResolver`. */
const FONTS_PREFIX = '/fonts';

/**
 * The font files this deployment stores, when it stores them itself.
 *
 * Off unless `fonts.dir` is configured, because a cloud deployment serves them from a CDN and would otherwise
 * shadow that path with a directory it does not have. Served CORS-open on purpose: a font is fetched in CORS mode
 * whatever its origin, so without this a page on the space's own domain cannot use a face from this server.
 */
export const fontAssetsStage: Stage = ctx => {
  const dir = ctx.config.fonts?.dir;
  if (!dir || !ctx.req.path.startsWith(`${FONTS_PREFIX}/`)) {
    return false;
  }

  ctx.res.setHeader('Access-Control-Allow-Origin', '*');
  ctx.res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const strippedReq: SSRRequest = { ...ctx.req, path: ctx.req.path.slice(FONTS_PREFIX.length) || '/' };
  if (serveStatic(strippedReq, ctx.res, dir)) {
    return true;
  }

  // Answered here rather than left to fall through: past this prefix the request is for a FILE, and letting it
  // reach the page router means a `@font-face` src that a manifest still points at is served a redirect, and then
  // a whole HTML document, where the browser expected a font.
  ctx.res.setStatus(404);
  ctx.res.send('Not found');

  return true;
};
