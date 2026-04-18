import type { SSRAdapters, SSRMiddleware, SSRContext } from '../types';

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
