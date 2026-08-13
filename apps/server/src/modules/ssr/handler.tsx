import { applySSRResult } from './applySSRResult';
import { buildBody } from './buildBody';
import { takeDraftOverride } from './preview';
import { streamBody } from './streamBody';
import { buildHtmlCacheKey } from '../../helpers/cache';
import { RequestMetrics } from '../../helpers/metrics';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  Environment,
  SSRPageServerConfig,
  SSRPageView,
  SSRRequest,
  SSRResponseHelpers,
  SSRTemplateFn
} from '@plitzi/sdk-shared';

// Metering a page must never be able to fail one. An adapter that throws (its store is down, its tables are
// missing) leaves the request uncounted and the render untouched, which is the only acceptable direction for
// the error: the alternative trades revenue accounting for an outage. Reporting it belongs to the adapter,
// which knows what went wrong and has the deployment's logger; here it is simply not fatal.
const resolvePageView = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  cached: boolean
): Promise<SSRPageView | undefined> => {
  if (!config.adapters.pageView) {
    return undefined;
  }

  try {
    return await config.adapters.pageView({ req, spaceId, environment, revision, cached });
  } catch {
    return undefined;
  }
};

export const renderSSR = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRPageServerConfig,
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

      // A cached page is still a page served, so it is still counted — a space that stopped being metered the
      // moment it got popular enough to hit the cache would be metered backwards. What the meter is told is that
      // this one was cheap to serve, the same fact `X-Cache` puts on the wire.
      await resolvePageView(req, config, spaceId as number, environment, revision, true);
      res.send(cached);

      return;
    }
  }

  // A draft preview is not a visit: it is the author looking at their own unsaved edits, and it is never cached.
  if (!offlineDataOverride) {
    req.ctx.pageView = await resolvePageView(req, config, spaceId as number, environment, revision, false);
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
