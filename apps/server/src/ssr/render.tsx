import { buildHtmlCacheKey } from '../helpers/cache';
import { buildBody } from './buildBody';

import type { TtlCache } from '../helpers/cache';
import type { PluginManager } from '../plugins/manager';
import type { Environment, SSRRequest, SSRResponseHelpers, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';

export const renderSSR = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRServerConfig,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  cache?: TtlCache<string>
): Promise<void> => {
  const { environment = 'main', spaceId = 1, revision = 0 } = req.ctx.spaceDeployment || {};
  if (cache && environment !== 'main') {
    const cacheKey = buildHtmlCacheKey(req.ctx.user?.token, spaceId, environment, revision, req);
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      res.send(cached);

      return;
    }

    const body = await buildBody(req, config, spaceId as number, environment, revision, renderFn, pluginManager);
    cache.set(cacheKey, body);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.send(body);

    return;
  }

  const body = await buildBody(req, config, spaceId as number, environment, revision, renderFn, pluginManager);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(body);
};
