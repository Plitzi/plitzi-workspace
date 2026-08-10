import { SDK_ASSETS_PREFIX, resolveSdkAssetsDir } from '../../sdkAssets';
import { serveStatic } from '../../staticFiles';

import type { Stage } from '../types';
import type { SSRRequest } from '@plitzi/sdk-shared';

// The consumer's own public directory.
export const publicDirStage: Stage = ctx =>
  ctx.config.publicDir ? serveStatic(ctx.req, ctx.res, ctx.config.publicDir) : false;

// Reserve /.well-known so it never falls through to SSR; nothing here serves it yet.
export const wellKnownStage: Stage = ctx => {
  if (!ctx.req.path.startsWith('/.well-known/')) {
    return false;
  }

  ctx.res.setStatus(404);
  ctx.res.end();

  return true;
};

// Extra static mounts declared via config.static, each under its own URL prefix. Served CORS-open (plus CORP, for
// an isolated context) so a document on another origin can load them — the SDK bundle a page hydrates with.
export const configStaticStage: Stage = ctx => {
  const { static: mounts } = ctx.config;
  if (!mounts) {
    return false;
  }

  for (const [prefix, rootDir] of Object.entries(mounts)) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    if (ctx.req.path === prefix || ctx.req.path.startsWith(normalizedPrefix)) {
      ctx.res.setHeader('Access-Control-Allow-Origin', '*');
      ctx.res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      const strippedReq: SSRRequest = { ...ctx.req, path: ctx.req.path.slice(prefix.length) || '/' };
      if (serveStatic(strippedReq, ctx.res, rootDir)) {
        return true;
      }
    }
  }

  return false;
};

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
