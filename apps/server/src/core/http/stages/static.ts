import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serveStatic } from '../../staticFiles';

import type { Stage } from '../types';
import type { SSRRequest } from '@plitzi/sdk-shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_PUBLIC_DIR = path.resolve(__dirname, '../../../public');

// Assets shipped with the SDK (favicon, error pages…).
export const builtinPublicStage: Stage = ctx => serveStatic(ctx.req, ctx.res, BUILTIN_PUBLIC_DIR);

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

// Extra static mounts declared via config.static, each under its own URL prefix.
export const configStaticStage: Stage = ctx => {
  const { static: mounts } = ctx.config;
  if (!mounts) {
    return false;
  }

  for (const [prefix, rootDir] of Object.entries(mounts)) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    if (ctx.req.path === prefix || ctx.req.path.startsWith(normalizedPrefix)) {
      const strippedReq: SSRRequest = { ...ctx.req, path: ctx.req.path.slice(prefix.length) || '/' };
      if (serveStatic(strippedReq, ctx.res, rootDir)) {
        return true;
      }
    }
  }

  return false;
};
