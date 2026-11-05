import { bearerMatches, readRawBody } from '@plitzi/sdk-kernel/http';
import { protocolRefusal } from '@plitzi/sdk-shared/functions';

import { RENDER_PATH, RENDER_PROTOCOL, readRenderAsk } from '../../render/protocol';

import type { RenderAnswer } from '../../render/protocol';
import type { RscElementResolver } from '@plitzi/sdk-kernel/engine';
import type { BaseContext, Stage } from '@plitzi/sdk-kernel/http';

const parse = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

/**
 * `POST /_render`: a page server's server element, resolved here — the remote half of §4.3. Behind `render.secret`, so
 * the user it names is the one the page server signed in; ahead of the deployment middleware, because the host it
 * arrives on is the worker's own and the space is said in the ask. A failure is answered as one, with the runs that
 * fed it, so the page shows its error state and a debugger sees where the flow broke.
 */
export const createRenderStage = (resolve: RscElementResolver, secret: string): Stage<BaseContext> => {
  const answer = (ctx: BaseContext, status: number, body: RenderAnswer | { error: string }): true => {
    ctx.res.setStatus(status);
    ctx.res.setHeader('Content-Type', 'application/json; charset=utf-8');
    ctx.res.send(JSON.stringify(body));

    return true;
  };

  return async ctx => {
    const { req } = ctx;
    if (req.path !== RENDER_PATH) {
      return false;
    }

    ctx.operation = 'render';
    if (req.method !== 'POST') {
      return answer(ctx, 405, { error: `${RENDER_PATH} is asked with POST` });
    }

    if (!bearerMatches(req.headers.authorization, secret)) {
      return answer(ctx, 401, { error: `${RENDER_PATH} is asked with the worker's render secret, as a bearer token` });
    }

    const body = parse(await readRawBody(ctx.raw));
    const ask = readRenderAsk(body);
    if (typeof ask === 'string') {
      return answer(ctx, 400, { error: ask });
    }

    const refusal = protocolRefusal(ask.protocol, RENDER_PROTOCOL, { here: 'worker', there: 'page server' });
    if (refusal) {
      return answer(ctx, 409, { error: refusal });
    }

    // What the resolvers read off the request, said by the page server that rendered it.
    req.ctx.spaceDeployment = { spaceId: ask.spaceId, environment: ask.environment, revision: ask.revision };
    if (ask.user) {
      req.ctx.user = ask.user;
    }

    if (ask.rscParams) {
      req.ctx.rscParams = ask.rscParams;
    }

    const runs: NonNullable<typeof req.ctx.actionRuns> = [];
    req.ctx.actionRuns = runs;
    try {
      const data = await resolve({
        element: ask.element,
        input: ask.input,
        flat: ask.subtree,
        routeParams: ask.routeParams,
        queryParams: ask.queryParams,
        templateData: { ...ask.templateData, paintedKeys: new Set(ask.templateData.paintedKeys) },
        req,
        spaceId: ask.spaceId,
        environment: ask.environment,
        user: ask.user,
        signal: ctx.signal
      });

      return answer(ctx, 200, { ok: true, data, runs });
    } catch (error) {
      const said = error instanceof Error && 'said' in error && typeof error.said === 'string' ? error.said : undefined;

      return answer(ctx, 200, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        refused: error instanceof Error && 'refused' in error && error.refused === true,
        ...(said === undefined ? {} : { said }),
        runs
      });
    }
  };
};
