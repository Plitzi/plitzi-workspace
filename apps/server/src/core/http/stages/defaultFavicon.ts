import { DEFAULT_FAVICON } from '@plitzi/sdk-shared/schema';

import { DEFAULT_FAVICON_SVG } from '../../../modules/ssr/defaultFavicon';

import type { Stage } from '@plitzi/sdk-kernel/http';

/** Plitzi's icon, at the address a page that names none points its tab at — see `DEFAULT_FAVICON_SVG`. */
export const defaultFaviconStage: Stage = ctx => {
  if (ctx.req.path !== DEFAULT_FAVICON) {
    return false;
  }

  if (ctx.req.method !== 'GET' && ctx.req.method !== 'HEAD') {
    ctx.res.setStatus(405);
    ctx.res.setHeader('Allow', 'GET, HEAD');
    ctx.res.send('Method not allowed');

    return true;
  }

  ctx.res.setHeader('Content-Type', 'image/svg+xml');
  // A day, as a stylesheet of Google's: the icon may change with a release, and a tab can wait a day to show it.
  ctx.res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  ctx.res.send(ctx.req.method === 'HEAD' ? '' : DEFAULT_FAVICON_SVG);

  return true;
};
