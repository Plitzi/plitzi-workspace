import type { SSRMiddleware, SSRRequest, SSRResponseHelpers, SSRContext } from '@plitzi/sdk-shared';

/**
 * Runs the chain, each middleware handing on by calling `next`. `timed`, when given, is told how long each one took
 * before it handed on — its own time, not the chain's after it — or until it ended the chain.
 */
export const runMiddlewares = async (
  middlewares: SSRMiddleware[],
  req: SSRRequest & Partial<SSRContext>,
  res: SSRResponseHelpers,
  timed?: (index: number, ms: number) => void
): Promise<boolean> => {
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
    const at = index - 1;
    const started = timed ? performance.now() : 0;
    await mw(req, res, async () => {
      nextState.called = true;
      timed?.(at, performance.now() - started);
      await next();
    });

    if (!nextState.called) {
      timed?.(at, performance.now() - started);
      state.stopped = true;
    }
  };

  await next();

  if (req.spaceDeployment) {
    req.ctx.spaceDeployment = req.spaceDeployment;
  }

  return state.stopped;
};
