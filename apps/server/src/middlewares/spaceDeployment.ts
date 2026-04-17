import type { SSRAdapters, SSRMiddleware, SSRContext } from '../types';

/**
 * Resolves the space deployment for the current request by delegating to
 * `adapters.getSpaceDeployment`.
 *
 * On success, stores the result in `ctx.spaceDeployment` and calls `next()`.
 * On error (missing space or failed verification), responds with a plain-text
 * error message and stops the pipeline.
 */
export const spaceDeploymentMiddleware = (adapters: SSRAdapters): SSRMiddleware => {
  return async (req, res, next) => {
    const ctx = req as typeof req & SSRContext;

    const deployment = await adapters.getSpaceDeployment(req);
    ctx.spaceDeployment = deployment;

    const { spaceId = 1, error } = deployment;
    if (spaceId === null || error) {
      res.setStatus(error?.code ?? 404);
      res.send(error?.message ?? 'Space not found');
      return;
    }

    await next();
  };
};
