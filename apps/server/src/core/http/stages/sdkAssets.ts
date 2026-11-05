import { serveStatic } from '@plitzi/sdk-kernel/http';

import { SDK_ASSETS_PREFIX, resolveSdkAssetsDir } from '../../sdkAssets';

import type { Stage } from '@plitzi/sdk-kernel/http';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';

// Resolved once: the answer cannot change while the process runs, and it is a filesystem lookup.
const sdkAssetsDir = resolveSdkAssetsDir();

/**
 * The SDK bundle, served from this package's own copy.
 *
 * The rendered page is told to fetch `/sdk-assets/plitzi-sdk.js`, and it is this server that puts the URL there — so
 * answering it is this server's job too, not a mount every deployment has to remember to declare. It runs after
 * `configStaticStage`, so a deployment serving its own build (a pinned version, a CDN mirror) still wins by
 * declaring `static: { '/sdk-assets': … }`.
 */
export const sdkAssetsStage: Stage = ctx => {
  if (!sdkAssetsDir || !ctx.req.path.startsWith(`${SDK_ASSETS_PREFIX}/`)) {
    return false;
  }

  // CORS-open, like the other asset mounts: a page on another origin may hydrate with this bundle.
  ctx.res.setHeader('Access-Control-Allow-Origin', '*');
  ctx.res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const strippedReq: SSRRequest = { ...ctx.req, path: ctx.req.path.slice(SDK_ASSETS_PREFIX.length) || '/' };

  return serveStatic(strippedReq, ctx.res, sdkAssetsDir);
};
