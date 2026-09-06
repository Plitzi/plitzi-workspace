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

  return serveStatic(strippedReq, ctx.res, dir);
};
