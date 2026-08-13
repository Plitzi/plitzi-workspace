import type { SSRMiddleware, SSRPageAdapters } from '@plitzi/sdk-shared';

export const spaceDeploymentMiddleware = (adapters: SSRPageAdapters): SSRMiddleware => {
  return async (req, res, next) => {
    const deployment = await adapters.getSpaceDeployment(req);
    req.ctx.spaceDeployment = deployment;

    const { spaceId, error, frameAncestors } = deployment;
    if (spaceId == null || error) {
      res.setStatus(error?.code ?? 404);
      res.send(error?.message ?? 'Space not found');
      return;
    }

    // Framing is a per-space question, so it is answered here rather than by the server-wide default in
    // applySecurityHeaders: one static list cannot know which sites THIS space's owner allowed. Overwrites the
    // default because it is strictly better informed. (CSP frame-ancestors supersedes X-Frame-Options wherever
    // both are understood, and a browser too old for it simply falls back to the stricter default — closed.)
    if (frameAncestors && frameAncestors.length > 0) {
      res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors.join(' ')}`);
    }

    await next();
  };
};
