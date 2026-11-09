import type { SSRAdapters } from '../../types';
import type { SSRMiddleware, SSRRequest } from '../../types';

export const authMiddleware = (adapters: SSRAdapters): SSRMiddleware => {
  return async (req: SSRRequest, res, next) => {
    // The response too: a session cookie that is over is cleared on it, or the browser goes on believing it holds one.
    const user = await adapters.getUser?.(req, res);
    req.ctx.user = user;

    await next();
  };
};
