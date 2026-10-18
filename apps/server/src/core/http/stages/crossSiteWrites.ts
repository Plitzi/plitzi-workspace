import { carrierOf, crossSiteRequest } from '../../auth/csrf';

import type { BaseContext, Stage } from '../types';

/** GET, HEAD and OPTIONS change nothing: a link or an `<img>` from anywhere is how the web works. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Whether this request is a write a page of another origin caused, and so is refused — answered here, 403
 * `reason: 'foreign'`, when it is.
 *
 * Not only a write a session cookie could authenticate: a server holding credentials of its own (a token for somebody's
 * calendar, an API key) or a tool with no sign-in at all acts for whoever reaches it, and a plain form POST from any
 * page open in the same browser reaches it without a preflight. Passes:
 *
 * - a safe method;
 * - `Authorization` — a page of another origin cannot set it without a preflight this server never allows;
 * - a request that is not a browser's (no `Sec-Fetch-Site`, no `Origin`): a webhook, `curl`, another server;
 * - a page of this origin (`same-origin` — never merely `same-site`: another port of this host, or a sibling
 *   sub-domain, is where somebody else's pages are served), or of an origin in `crossSiteWrites.origins`;
 * - a path in `crossSiteWrites.paths` — a form other sites post to by design.
 */
export const refusedCrossSite = (ctx: BaseContext): boolean => {
  const { req, res, config } = ctx;
  const allowed = config.crossSiteWrites;
  if (
    SAFE_METHODS.has(req.method.toUpperCase()) ||
    req.headers.authorization !== undefined ||
    allowed?.paths?.(req.path) === true ||
    !crossSiteRequest(carrierOf(req), origin => allowed?.origins?.includes(origin) === true)
  ) {
    return false;
  }

  ctx.operation = 'refused:cross-site';
  res.setStatus(403);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(
    JSON.stringify({
      error: `A page of another origin may not ${req.method} ${req.path} here: name its origin in the server's \`crossSiteWrites.origins\`, or the path in \`crossSiteWrites.paths\``,
      reason: 'foreign'
    })
  );

  return true;
};

/**
 * Every write the page server answers after it — server actions, realtime publishes, a space's `/fn/` routes and its
 * runtime's endpoints, the deployment's own data stages — refused when a page of another origin caused it (see
 * {@link refusedCrossSite}). After the stages that gate themselves (`preAuth`: the `/auth` flows with their own CSRF,
 * MCP and its OAuth, the preview's shared secret), before everything else.
 */
export const crossSiteWritesStage: Stage = refusedCrossSite;
