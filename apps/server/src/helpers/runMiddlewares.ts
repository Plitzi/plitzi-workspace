import type { SSRMiddleware, SSRRequest, SSRResponseHelpers, SSRContext } from '../types';

/**
 * Execute an ordered list of middlewares.
 *
 * Each middleware receives `(req, res, next)`. Calling `next()` advances to
 * the following middleware. If a middleware does **not** call `next()` the
 * chain stops (e.g. when it writes an error response).
 *
 * `onStop` is invoked once the chain finishes or is aborted by a middleware
 * that does not call `next()`.  The caller uses this flag to know whether it
 * should proceed to SSR rendering.
 */
export const runMiddlewares = async (
  middlewares: SSRMiddleware[],
  req: SSRRequest & Partial<SSRContext>,
  res: SSRResponseHelpers,
  ctx: SSRContext,
  onStop: () => void
): Promise<void> => {
  // Merge ctx into req so middlewares can read/write it via req directly.
  Object.assign(req, ctx);

  let index = 0;
  let stopped = false;

  const next = async (): Promise<void> => {
    if (stopped) return;
    const mw = middlewares[index++];
    if (!mw) return;

    let nextCalled = false;
    await mw(req, res, async () => {
      nextCalled = true;
      await next();
    });

    if (!nextCalled && index <= middlewares.length) {
      stopped = true;
      onStop();
    }
  };

  await next();

  // Sync ctx from req after all middlewares have run.
  if (req.spaceDeployment) {
    ctx.spaceDeployment = req.spaceDeployment;
  }
};
