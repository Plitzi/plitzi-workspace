import type { SSRMiddleware, SSRRequest, SSRResponseHelpers, SSRContext } from '../types';

export const runMiddlewares = async (
  middlewares: SSRMiddleware[],
  req: SSRRequest & Partial<SSRContext>,
  res: SSRResponseHelpers,
  ctx: SSRContext,
  onStop: () => void
): Promise<void> => {
  Object.assign(req, ctx);

  let index = 0;
  let stopped: boolean = false;

  const next = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    const mw = index < middlewares.length ? middlewares[index++] : undefined;
    if (!mw) {
      return;
    }

    let nextCalled: boolean = false;
    await mw(req, res, async () => {
      nextCalled = true;
      await next();
    });

    if (!nextCalled) {
      stopped = true;
      onStop();
    }
  };

  await next();

  if (req.spaceDeployment) {
    ctx.spaceDeployment = req.spaceDeployment;
  }
};
