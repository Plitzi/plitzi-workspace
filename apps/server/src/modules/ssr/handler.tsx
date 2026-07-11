import { applySSRResult } from './applySSRResult';
import { buildBody } from './buildBody';
import { takeDraftOverride } from './preview';
import { streamBody } from './streamBody';
import { buildHtmlCacheKey } from '../../helpers/cache';
import { RequestMetrics } from '../../helpers/metrics';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { SSRRequest, SSRResponseHelpers, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';

export const renderSSR = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRServerConfig,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  caches: ServerCaches
): Promise<void> => {
  const { environment = 'main', spaceId = 1, revision = 0 } = req.ctx.spaceDeployment || {};
  const devMode = config.devMode ?? false;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // A one-shot preview token renders unsaved draft edits (never persisted); such a render is never cached.
  const offlineDataOverride = await takeDraftOverride(req, config);

  // Cache is disabled for the main environment (development) and for any draft-override render.
  const htmlCache = environment !== 'main' && !offlineDataOverride ? caches.html : undefined;
  const cacheKey = htmlCache ? buildHtmlCacheKey(req.ctx.user?.token, spaceId, environment, revision, req) : undefined;

  if (htmlCache && cacheKey) {
    const cached = htmlCache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      if (devMode) {
        res.setHeader('Server-Timing', 'html;desc="cache-hit";dur=0');
      }
      res.send(cached);
      return;
    }
  }

  // Allocate metrics after the cache-hit early return — never wasted on hits.
  const metrics = devMode ? new RequestMetrics() : undefined;

  if (cacheKey) {
    res.setHeader('X-Cache', 'MISS');
  }

  if (config.streaming) {
    await streamBody(
      req,
      res,
      config,
      spaceId as number,
      environment,
      revision,
      renderFn,
      pluginManager,
      caches.offlineData,
      htmlCache,
      cacheKey,
      metrics,
      offlineDataOverride
    );

    return;
  }

  const { body, result } = await buildBody(
    req,
    config,
    spaceId as number,
    environment,
    revision,
    renderFn,
    pluginManager,
    caches.offlineData,
    metrics,
    offlineDataOverride
  );

  if (metrics) {
    res.setHeader('Server-Timing', metrics.toServerTimingHeader());
    metrics.log(`${req.method} ${req.path}`);
  }

  if (applySSRResult(res, result)) {
    return;
  }

  if (htmlCache && cacheKey && body !== undefined) {
    htmlCache.set(cacheKey, body);
  }

  res.send(body ?? '');
};
