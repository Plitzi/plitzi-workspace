import { buildBody } from './buildBody';
import { streamBody } from './streamBody';
import { buildHtmlCacheKey } from '../helpers/cache';
import { RequestMetrics } from '../helpers/metrics';

import type { ServerCaches } from '../helpers/cache';
import type { PluginManager } from '../plugins/manager';
import type { SSRRequest, SSRResponseHelpers, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';

const applyMetrics = (res: SSRResponseHelpers, metrics: RequestMetrics, label: string): void => {
  res.setHeader('Server-Timing', metrics.toServerTimingHeader());
  metrics.log(label);
};

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
  const streaming = config.streaming ?? false;
  const label = `${req.method} ${req.path}`;

  if (caches.html && environment !== 'main') {
    const cacheKey = buildHtmlCacheKey(req.ctx.user?.token, spaceId, environment, revision, req);
    const cached = caches.html.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Cache', 'HIT');
      if (devMode) {
        res.setHeader('Server-Timing', 'html;desc="cache-hit";dur=0');
      }

      res.send(cached);

      return;
    }

    if (streaming) {
      const metrics = devMode ? new RequestMetrics() : undefined;
      res.setHeader('X-Cache', 'MISS');
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
        caches.html,
        cacheKey,
        metrics
      );

      return;
    }

    const metrics = devMode ? new RequestMetrics() : undefined;
    const body = await buildBody(
      req,
      config,
      spaceId as number,
      environment,
      revision,
      renderFn,
      pluginManager,
      caches.offlineData,
      metrics
    );
    caches.html.set(cacheKey, body);
    if (metrics) {
      applyMetrics(res, metrics, label);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.send(body);

    return;
  }

  if (streaming) {
    const metrics = devMode ? new RequestMetrics() : undefined;
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
      undefined,
      undefined,
      metrics
    );

    return;
  }

  const metrics = devMode ? new RequestMetrics() : undefined;
  const body = await buildBody(
    req,
    config,
    spaceId as number,
    environment,
    revision,
    renderFn,
    pluginManager,
    caches.offlineData,
    metrics
  );
  if (metrics) {
    applyMetrics(res, metrics, label);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(body);
};
