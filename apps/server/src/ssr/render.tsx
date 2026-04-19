import { buildBody } from './buildBody';

import type { TtlCache } from '../helpers/ttlCache';
import type { PluginManager } from '../plugins/manager';
import type { SSRRequest, SSRResponseHelpers, SSRServerConfig, SSRTemplateFn } from '../types';
import type { Environment } from '@plitzi/sdk-shared';

export const buildCacheKey = (
  accessToken: string | undefined = 'anonymous',
  spaceId: number | string | null,
  environment: Environment,
  revision: number,
  req: SSRRequest
): string =>
  `${accessToken}\0${spaceId ?? 1}\0${environment}\0${revision}\0${req.hostname}\0${req.path}\0${req.search}`;

export const renderSSR = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRServerConfig,
  renderFn: SSRTemplateFn,
  cache?: TtlCache<string>,
  pluginManager?: PluginManager // optional — no plugins if not provided
): Promise<void> => {
  const {
    environment = 'main',
    spaceId = 1,
    revision = 0
  } = req.ctx.spaceDeployment as Exclude<typeof req.ctx.spaceDeployment, undefined>;

  if (cache) {
    const cacheKey = buildCacheKey(req.ctx.user?.token, spaceId, environment, revision, req);
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      res.send(cached);
      return;
    }

    const body = await buildBody(
      req,
      config,
      spaceId as number,
      environment as string,
      revision,
      renderFn,
      pluginManager
    );
    cache.set(cacheKey, body);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.send(body);

    return;
  }

  const body = await buildBody(
    req,
    config,
    spaceId as number,
    environment as string,
    revision,
    renderFn,
    pluginManager
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(body);
};
