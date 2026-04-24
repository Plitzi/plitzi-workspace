import type { SSRAdapters, SSRMiddleware } from '../types';

export const spaceDeploymentMiddleware = (adapters: SSRAdapters): SSRMiddleware => {
  return async (req, res, next) => {
    const deployment = await adapters.getSpaceDeployment(req);
    req.ctx.spaceDeployment = deployment;

    const { spaceId, error } = deployment;
    if (spaceId == null || error) {
      res.setStatus(error?.code ?? 404);
      res.send(error?.message ?? 'Space not found');
      return;
    }

    await next();
  };
};
