import type { SSRMiddleware, SSRRequest, SSRResponseHelpers, SSRContext } from '../types';

export const runMiddlewares = async (
  middlewares: SSRMiddleware[],
  req: SSRRequest & Partial<SSRContext>,
  res: SSRResponseHelpers,
  ctx: SSRContext
): Promise<boolean> => {
  Object.assign(req, ctx);

  let index = 0;
  const state = { stopped: false };

  const next = async (): Promise<void> => {
    if (state.stopped) {
      return;
    }
    const mw = index < middlewares.length ? middlewares[index++] : undefined;
    if (!mw) {
      return;
    }

    const nextState = { called: false };
    await mw(req, res, async () => {
      nextState.called = true;
      await next();
    });

    if (!nextState.called) {
      state.stopped = true;
    }
  };

  await next();

  if (req.spaceDeployment) {
    ctx.spaceDeployment = req.spaceDeployment;
  }

  return state.stopped;
};
