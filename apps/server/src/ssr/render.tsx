import { buildBody } from './buildBody';

import type { TtlCache } from '../helpers/ttlCache';
import type { SSRRequest, SSRResponseHelpers, SSRContext, SSRServerConfig } from '../types';

export const buildCacheKey = (
  spaceId: number | string | null,
  environment: string,
  revision: number,
  req: SSRRequest
): string => `${spaceId ?? 1}\0${environment}\0${revision}\0${req.hostname}\0${req.path}\0${req.search}`;

export const renderSSR = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  ctx: SSRContext,
  config: SSRServerConfig,
  cache?: TtlCache<string>
): Promise<void> => {
  const {
    environment = 'main',
    spaceId = 1,
    revision = 0
  } = ctx.spaceDeployment as Exclude<typeof ctx.spaceDeployment, undefined>;

  if (cache) {
    const cacheKey = buildCacheKey(spaceId, environment as string, revision, req);
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      res.send(cached);
      return;
    }

    const body = await buildBody(req, ctx, config, spaceId as number, environment as string, revision);
    cache.set(cacheKey, body);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.send(body);
    return;
  }

  const body = await buildBody(req, ctx, config, spaceId as number, environment as string, revision);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(body);
};
