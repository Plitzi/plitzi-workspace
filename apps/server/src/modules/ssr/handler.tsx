import { applySSRResult, isReusable, renderParamsOf } from './applySSRResult';
import { buildBody } from './buildBody';
import { pageHints } from './earlyHints';
import { meterPage } from './meterPage';
import { claimRender, pageSlot, readPage, renderingNow } from './pageCache';
import { draftSessionCookie, takeDraftOverride } from './preview';
import { DEFAULT_RENDER_WAIT_MS, renderLimitFor } from './renderTurns';
import { streamBody } from './streamBody';
import { buildHtmlCacheKey, ignoredQueryParamsOf, keepsVersion, pageHtml, renderedQuery } from '../../helpers/cache';
import { resolveCompression } from '../../helpers/compress';
import { escapeHtml } from '../../helpers/escapeHtml';
import { RequestMetrics } from '../../helpers/metrics';
import { serverLog } from '../../helpers/serverLog';
import { SCHEME_HINT_HEADER } from '../../helpers/visitorScheme';

import type { BuildBodyResult } from './buildBody';
import type { RenderClaim } from './pageCache';
import type { CachedPage, ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  SSRMeterDecision,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRTemplateFn
} from '@plitzi/sdk-shared';

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

/** How long a page answered busy tells its visitor to wait before asking again, in seconds. */
const BUSY_RETRY_AFTER_S = 2;

/** The turn of a space with no limit: nothing to give back. */
const noTurn = (): void => undefined;

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
  // Read once: a deployment's value it cannot use is said here, not on every turn asked of it.
  const limit = renderLimitFor(req.ctx.spaceDeployment, config.renderLimit);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // A `system` theme is drawn as the machine asks (`theme.resolved`): Chromium says which from its next request on.
  res.setHeader('Accept-CH', SCHEME_HINT_HEADER);
  res.setHeader('Vary', SCHEME_HINT_HEADER);
  // Sent once the page is known to be rendered: that wait is what the browser spends fetching the stylesheets.
  const hint = pageHints(config, res);

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

  // Kept for a published revision, and for the draft (`main`, edited right then) only under the version every edit
  // changes (`keepsVersion`); never for a draft-override render, a one-shot of unsaved edits.
  const htmlCache = keepsVersion(req.ctx.spaceDeployment) && !offlineDataOverride ? caches.html : undefined;
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
      // Only on a turn free right now: past its space's limit the stale page is served again, and drawn later.
      const turn =
        kept.stale && decision?.unavailable === undefined && !renderingNow(slot)
          ? limit === undefined
            ? noTurn
            : caches.turns.tryTake(spaceId as number, limit)
          : undefined;
      if (turn) {
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
          .finally(() => {
            claim.release();
            turn();
          });
      }

      return;
    }

    // Another request is rendering this very page: this one is served what that render keeps.
    const waiting = renderingNow(slot);
    if (waiting) {
      hint();
      const waited = await waiting;
      if (waited) {
        await serveKept(waited, 'HIT');

        return;
      }
    }
  }

  // Taken in this same turn as the look above: an `await` between the two let every request of a burst render.
  // Claimed before the turn is waited for: whoever asks for this same page meanwhile waits on this one render.
  const claim = slot && !renderingNow(slot) ? claimRender(slot) : undefined;
  // Rendered here, after a turn that may be waited for: both are the wait a hint lets the browser spend.
  hint();
  try {
    const turn =
      limit === undefined
        ? noTurn
        : await caches.turns.take(spaceId as number, limit, config.renderLimit?.waitMs ?? DEFAULT_RENDER_WAIT_MS);
    if (!turn) {
      caches.turns.refused(spaceId as number, limit ?? 0);
      res.setHeader('Retry-After', String(BUSY_RETRY_AFTER_S));
      sendUnavailable(res, 'This site is busy right now. Try again in a moment.');

      return;
    }

    try {
      await renderFresh(claim);
    } finally {
      turn();
    }
  } finally {
    claim?.release();
  }
};
