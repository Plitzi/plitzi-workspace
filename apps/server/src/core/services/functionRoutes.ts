import { FUNCTION_ROUTES_PREFIX } from '@plitzi/sdk-shared/actions';

import { clientIp, readRawBytes, requestOrigin } from '../requestParser';

import type { SSRContext, Stage } from '../http/types';

/**
 * The space's functions answering HTTP under `/fn/`: a request there that a declared route answers is run
 * by it — the deployment's own routes first, then the space's, in the sandbox — and anything else goes on to the page
 * server, which answers as it would have. `/fn` is never a page: its slug is refused, so the path is the functions'.
 *
 * After the auth chain, so `ctx.user` is who the session says; the session itself never reaches the code.
 */
export const functionRoutesStage: Stage<SSRContext> = async ctx => {
  const { req, actions } = ctx;
  const { spaceId, environment = 'main', revision = 0 } = req.ctx.spaceDeployment ?? {};
  if (!actions || typeof spaceId !== 'number' || !req.path.startsWith(`${FUNCTION_ROUTES_PREFIX}/`)) {
    return false;
  }

  const route = await actions.routeFor(
    {
      spaceId,
      environment,
      at: { environment, revision },
      ...(req.ctx.user ? { user: req.ctx.user } : {}),
      callerId: req.ctx.user ? `user:${String(req.ctx.user.id)}` : `ip:${clientIp(ctx.raw, req)}`,
      signal: ctx.signal
    },
    req.method,
    req.path.slice(FUNCTION_ROUTES_PREFIX.length)
  );
  if (!route) {
    return false;
  }

  ctx.operation = 'function:route';
  const headers = new Headers();
  Object.entries(req.headers).forEach(([name, value]) => {
    if (!name.startsWith(':') && value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  });
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const response = await route.handle(
    new Request(`${requestOrigin(req) || `${req.protocol}://${req.hostname}`}${req.url}`, {
      method: req.method,
      headers,
      ...(hasBody ? { body: new Uint8Array(await readRawBytes(ctx.raw)) } : {})
    })
  );

  ctx.res.setStatus(response.status);
  response.headers.forEach((value, name) => {
    ctx.res.setHeader(name, value);
  });
  // Always fresh: an answer computed per request is not one a cache in front of the page server may keep.
  if (!response.headers.has('cache-control')) {
    ctx.res.setHeader('Cache-Control', 'no-store');
  }

  ctx.res.send(Buffer.from(await response.arrayBuffer()));

  return true;
};
