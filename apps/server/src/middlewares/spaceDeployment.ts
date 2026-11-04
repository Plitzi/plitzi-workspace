import { frameAncestorsOf, hstsFor } from '../core/http/securityHeaders';

import type { SSRMiddleware, SSRPageAdapters, SSRServerConfig } from '@plitzi/sdk-shared';

export const spaceDeploymentMiddleware = (
  adapters: SSRPageAdapters,
  config: Pick<SSRServerConfig, 'frameOptions' | 'hsts'>
): SSRMiddleware => {
  return async (req, res, next) => {
    const deployment = await adapters.getSpaceDeployment(req);
    req.ctx.spaceDeployment = deployment;

    const { spaceId, error, frameAncestors, security } = deployment;
    if (spaceId == null || error) {
      res.setStatus(error?.code ?? 404);
      res.send(error?.message ?? 'Space not found');
      return;
    }

    // Framing is a per-space question, so it is answered here rather than by the server-wide default in
    // applySecurityHeaders: one static list cannot know which sites THIS space's owner allowed. Overwrites the
    // default because it is strictly better informed. (CSP frame-ancestors supersedes X-Frame-Options wherever
    // both are understood, and a browser too old for it simply falls back to the stricter default — closed.) A page's
    // response writes it again, beside its script policy (`sendScriptPolicy`).
    if ((frameAncestors?.length ?? 0) > 0 || (security?.frameAncestors?.length ?? 0) > 0) {
      res.setHeader('Content-Security-Policy', frameAncestorsOf(config, deployment) ?? '');
    }

    // A domain of the owner's own says how far https reaches on it: its sub-domains are theirs, not this server's.
    const chosen = security?.hsts;
    if (chosen !== undefined) {
      const hsts = hstsFor(req, config, chosen);
      if (hsts) {
        res.setHeader('Strict-Transport-Security', hsts);
      } else {
        // Its name as `applySecurityHeaders` wrote it: the headers are kept by the name they were set with.
        Reflect.deleteProperty(res.headers, 'Strict-Transport-Security');
      }
    }

    await next();
  };
};
