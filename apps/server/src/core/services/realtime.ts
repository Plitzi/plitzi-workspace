import { handleRealtimePublish, handleRealtimeSubscribe } from '../../modules/realtime';
import { readRawBody } from '../requestParser';

import type { SSRContext, Stage } from '../http/types';

/**
 * `/_realtime`: a page subscribing (GET, a stream that stays open) and publishing (POST).
 *
 * After the auth middleware, like the action endpoint: who may open a channel depends on who is asking.
 */
export const realtimeStage: Stage<SSRContext> = async ctx => {
  const { realtime, req } = ctx;
  if (!realtime || req.path !== realtime.path) {
    return false;
  }

  if (req.method === 'GET') {
    ctx.operation = 'realtime:subscribe';
    await handleRealtimeSubscribe({
      req,
      res: ctx.res,
      raw: ctx.rawRes,
      signal: ctx.signal,
      hub: realtime.hub,
      resolveChannels: realtime.resolveChannels
    });

    return true;
  }

  if (req.method === 'POST') {
    ctx.operation = 'realtime:publish';
    req.body = await readRawBody(ctx.raw);
    await handleRealtimePublish({ req, res: ctx.res, hub: realtime.hub });

    return true;
  }

  ctx.res.setStatus(405);
  ctx.res.setHeader('Allow', 'GET, POST');
  ctx.res.send('');

  return true;
};
