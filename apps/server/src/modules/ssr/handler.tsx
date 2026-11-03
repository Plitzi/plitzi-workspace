import { applySSRResult, isReusable, renderParamsOf } from './applySSRResult';
import { buildBody } from './buildBody';
import { claimRender, pageSlot, readPage, renderingNow } from './pageCache';
import { draftSessionCookie, takeDraftOverride } from './preview';
import { streamBody } from './streamBody';
import { buildHtmlCacheKey, ignoredQueryParamsOf, pageHtml, renderedQuery } from '../../helpers/cache';
import { resolveCompression } from '../../helpers/compress';
import { escapeHtml } from '../../helpers/escapeHtml';
import { RequestMetrics } from '../../helpers/metrics';
import { serverLog } from '../../helpers/serverLog';

import type { BuildBodyResult } from './buildBody';
import type { RenderClaim } from './pageCache';
import type { CachedPage, ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  Environment,
  SSRMeterDecision,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRTemplateFn
} from '@plitzi/sdk-shared';

// Metering a page must never be able to fail one. An adapter that throws (its store is down, its tables are
// missing) leaves the request uncounted and the render untouched, which is the only acceptable direction for
// the error: the alternative trades revenue accounting for an outage. Reporting it belongs to the adapter,
// which knows what went wrong and has the deployment's logger; here it is simply not fatal.
const meterPage = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  cached: boolean
): Promise<SSRMeterDecision | undefined> => {
  if (!config.adapters.meter) {
    return undefined;
  }

  const started = config.devMode ? performance.now() : 0;
  try {
    return await config.adapters.meter({ kind: 'page_view', cached, req, spaceId, environment, revision });
  } catch {
    return undefined;
  } finally {
    if (config.devMode) {
      req.ctx.timings = [...(req.ctx.timings ?? []), { name: 'meter', dur: Math.round(performance.now() - started) }];
    }
  }
};

/**
 * A page the deployment holds back (`SSRMeterDecision.unavailable`), in the words it chose: 503, kept by nobody — no
 * cache, no index — and nothing of the space rendered. Light and dark, as the visitor's system is.
 */
const sendUnavailable = (res: SSRResponseHelpers, said: string): void => {
  res.setStatus(503);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not available</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:16px/1.5 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#fff;color:#18181b}@media (prefers-color-scheme:dark){body{background:#09090b;color:#f4f4f5}}main{max-width:520px;padding:24px;text-align:center}</style></head><body><main><p>${escapeHtml(said)}</p></main></body></html>`
  );
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

  // A preview token renders unsaved draft edits (never persisted); such a render is never cached.
  const draft = await takeDraftOverride(req, config);
  const offlineDataOverride = draft?.data;

  if (draft?.inspected) {
    req.ctx.inspectedDraft = true;
  }

  if (draft) {
    /**
     * Unsaved work, told not to travel.
     *
     * `no-store` because every layer between here and the browser would otherwise be free to hand this render to
     * somebody else, and `noindex` because a draft URL that reaches a crawler puts unpublished copy in a search
     * result. Neither is a nicety: the whole point of a draft is that it is not the site yet.
     */
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    // Only a reusable draft is remembered: a one-shot token is spent by the render that is happening right now, and
    // a cookie holding it would send every later request looking for something that is gone.
    if (draft.reusable) {
      res.setHeader('Set-Cookie', draftSessionCookie(req, draft.token, config.preview?.sessionTtlMs ?? 900_000));
    }
  }

  // Cache is disabled for the main environment (development) and for any draft-override render.
  const htmlCache = environment !== 'main' && !offlineDataOverride ? caches.html : undefined;
  const ignored = ignoredQueryParamsOf(config);
  // Rendered as it is keyed: a page kept without the analytics parameters of a link must not have been drawn with them.
  if (htmlCache) {
    req.query = renderedQuery(req.query, ignored);
  }

  const compression = resolveCompression(config.compression);
  const slot = htmlCache
    ? pageSlot(
        config,
        caches,
        buildHtmlCacheKey(req.ctx.user?.token, spaceId, environment, revision, req, ignored),
        { spaceId: spaceId as number, environment, hostname: req.hostname },
        req.ctx.user === undefined,
        compression
      )
    : undefined;

  const renderPage = (metrics?: RequestMetrics) => () =>
    buildBody(
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
  const keepable = ({ body, result, cacheable }: BuildBodyResult): string | undefined =>
    body !== undefined && cacheable && isReusable(result) ? body : undefined;

  /**
   * A kept page, served — and counted: a space that stopped being metered the moment it got popular enough to hit the
   * cache would be metered backwards. What the meter is told is that this one was cheap to serve, the same fact
   * `X-Cache` puts on the wire.
   */
  const serveKept = async (page: CachedPage, cacheState: 'HIT' | 'STALE'): Promise<SSRMeterDecision | undefined> => {
    res.setHeader('X-Cache', cacheState);
    if (devMode) {
      res.setHeader('Server-Timing', `html;desc="cache-${cacheState.toLowerCase()}";dur=0`);
    }

    const decision = await meterPage(req, config, spaceId as number, environment, revision, true);
    if (decision?.unavailable !== undefined) {
      sendUnavailable(res, decision.unavailable);

      return decision;
    }

    if (decision?.noindex) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    // A copy of the compressed forms: one made for a client that takes another encoding is not added to the kept page
    // behind the cache's back, where its bytes would go uncounted.
    res.send(() => pageHtml(page), { compressed: { ...page.compressed } });

    return decision;
  };

  /** The page rendered for this request — kept for the others when `claim` says this render is the one they wait on. */
  const renderFresh = async (claim: RenderClaim | undefined): Promise<void> => {
    // A draft preview is not a visit: it is the author looking at their own unsaved edits, and it is never cached.
    if (!offlineDataOverride) {
      req.ctx.meter = await meterPage(req, config, spaceId as number, environment, revision, false);
      if (req.ctx.meter?.unavailable !== undefined) {
        sendUnavailable(res, req.ctx.meter.unavailable);

        return;
      }

      // An address the deployment does not host sites on, said to crawlers whatever the page's own robots say.
      if (req.ctx.meter?.noindex) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
    }

    // Allocate metrics after the cache-hit early return — never wasted on hits.
    const metrics = devMode ? new RequestMetrics(req.ctx.timings) : undefined;

    if (slot) {
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
        claim ? html => claim.keep(html) : undefined,
        metrics,
        offlineDataOverride
      );

      return;
    }

    const rendered = await renderPage(metrics)();
    const page = claim?.keep(keepable(rendered));

    if (metrics) {
      res.setHeader('Server-Timing', metrics.toServerTimingHeader());
      metrics.log(`${req.method} ${req.path}`);
    }

    if (applySSRResult(res, rendered.result, renderParamsOf(req.query))) {
      return;
    }

    res.send(rendered.body ?? '', page ? { compressed: { ...page.compressed } } : undefined);
  };

  if (slot) {
    const kept = await readPage(slot);
    if (kept) {
      const decision = await serveKept(kept.page, kept.stale ? 'STALE' : 'HIT');
      // Served as it was, and rendered again behind it for whoever asks next — once, however many ask meanwhile.
      if (kept.stale && decision?.unavailable === undefined && !renderingNow(slot)) {
        const claim = claimRender(slot);
        req.ctx.meter = decision;
        renderPage()()
          .then(rendered => {
            if (!claim.keep(keepable(rendered))) {
              caches.html?.delete(slot.key);
            }
          })
          .catch((error: unknown) => {
            caches.html?.delete(slot.key);
            serverLog.warn('SSR cache', `${req.path} could not be rendered again; the next request renders it`, error);
          })
          .finally(claim.release);
      }

      return;
    }

    // Another request is rendering this very page: this one is served what that render keeps.
    const waiting = renderingNow(slot);
    if (waiting) {
      const waited = await waiting;
      if (waited) {
        await serveKept(waited, 'HIT');

        return;
      }
    }
  }

  // Taken in this same turn as the look above: an `await` between the two let every request of a burst render.
  const claim = slot && !renderingNow(slot) ? claimRender(slot) : undefined;
  try {
    await renderFresh(claim);
  } finally {
    claim?.release();
  }
};
