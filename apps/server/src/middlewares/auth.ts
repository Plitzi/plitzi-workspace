import type { SSRAdapters, SSRMiddleware, SSRRequest } from '@plitzi/sdk-shared';

export const authMiddleware = (adapters: SSRAdapters): SSRMiddleware => {
  return async (req: SSRRequest, _res, next) => {
    const user = await adapters.getUser?.(req);
    req.ctx.user = user;

    await next();
  };
};
