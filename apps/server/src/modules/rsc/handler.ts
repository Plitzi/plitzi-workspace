import { readDraftToken } from '../../core/previewToken';
import { buildRscCacheKey, DEFAULT_TTL_MS } from '../../helpers/cache';
import { createOfflineDataLoader } from '../../helpers/offlineDataLoader';

import type { TtlCache } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { Environment, SSRPageServerConfig, SSRRequest, SSRResponseHelpers, SSRRscData } from '@plitzi/sdk-shared';

/** Payload returned by the /_rsc endpoint. */
type RscPayload = {
  version: 1;
  transport: 'json';
  spaceId: number;
  environment: Environment;
  revision: number;
} & SSRRscData;

/** Bounds the reflected location: it only ever selects one of this space's own pages, but it is still input. */
const MAX_PAGE_LOCATION = 2048;

// Same contract as the page meter: never throws, and a deployment that meters nothing omits the adapter.
const meterRsc = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  cached: boolean
): Promise<void> => {
  if (!config.adapters.meter) {
    return;
  }

  try {
    await config.adapters.meter({ kind: 'rsc_query', cached, req, spaceId, environment, revision });
  } catch {
    // Metering must never fail the read it is measuring.
  }
};

/**
 * Rewrites the request to the page the browser is actually on.
 *
 * A refresh is issued against `/_rsc`, not against `/blog/my-post`, so resolving straight from `req.path` matches
 * nothing in `schema.pages` and every client-side refresh silently returns no data. The SDK sends the visitor's
 * location as `?location=`, and route params plus the page parameter are read from that instead.
 *
 * Reflecting it is safe by construction: it is matched against this space's own page list, so the worst a forged
 * value can do is resolve a page the same visitor could have loaded directly.
 */
const withPageLocation = (req: SSRRequest): SSRRequest => {
  const location = req.query.location;
  if (!location || !location.startsWith('/') || location.length > MAX_PAGE_LOCATION) {
    return req;
  }

  const url = new URL(location, `${req.protocol}://${req.hostname}`);
  const query = [...url.searchParams.entries()].reduce<Record<string, string>>((acum, [key, value]) => {
    acum[key] = value;

    return acum;
  }, {});

  return { ...req, path: url.pathname, search: url.search, url: `${url.pathname}${url.search}`, query };
};

/**
 * Handles GET /_rsc requests.
 *
 * Calls adapters.getRscData to get server-side data for elements marked
 * runtime:'server' in the schema, then returns a JSON payload. The SDK
 * client uses this payload to update server-driven portions of the page
 * without a full navigation.
 *
 * Responses are cached server-side (TtlCache) and via Cache-Control headers:
 * - main environment: no-store (development, always fresh)
 * - Authenticated requests: Cache-Control: private, max-age=<ttl>
 * - Unauthenticated requests: Cache-Control: public, max-age=<ttl>
 */
export const handleRsc = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRPageServerConfig,

  _pluginManager: PluginManager,
  cache?: TtlCache<string>
): Promise<void> => {
  if (!config.adapters.getRscData) {
    res.setStatus(501);
    res.send(JSON.stringify({ error: 'getRscData adapter not configured' }));

    return;
  }

  const { environment = 'main', spaceId, revision = 0 } = req.ctx.spaceDeployment ?? {};
  if (typeof spaceId !== 'number') {
    res.setStatus(400);
    res.send(JSON.stringify({ error: 'Invalid space deployment' }));

    return;
  }

  const idsRaw = req.query.ids;
  // Bound the ids array to prevent DoS via enormous query strings.
  const ids = idsRaw
    ? idsRaw
        .split(',')
        .filter(Boolean)
        .slice(0, 50)
        .map(id => id.slice(0, 128))
    : undefined;
  const idsParam = ids?.join(',');
  const pageRequest = withPageLocation(req);

  /**
   * Whether this refresh belongs to somebody looking at a draft.
   *
   * The page render already refuses to meter or cache a draft, and before draft SESSIONS existed that was the whole
   * story: a one-shot token was spent by the render, so no refresh could ever carry one. A reusable token can, and a
   * page left open in a preview asks for data on its own — so without this, iterating on unsaved work would be
   * billed as live traffic and would show up on the live view as visitors nobody has.
   *
   * The token is not resolved here: whether the draft is still in the store decides what the PAGE renders, and a
   * refresh that arrives a second after it expired is still part of the same preview.
   */
  const previewing = readDraftToken(req) !== undefined;

  const ttlMs = config.rsc?.cacheTtlMs ?? DEFAULT_TTL_MS.rsc;
  const isAuthenticated = !!req.ctx.user;
  const cacheControl =
    environment === 'main' || previewing
      ? 'no-store'
      : isAuthenticated
        ? `private, max-age=${Math.floor(ttlMs / 1000)}`
        : `public, max-age=${Math.floor(ttlMs / 1000)}`;

  // main is the development environment — never cache it.
  const cacheKey =
    environment !== 'main' && !previewing
      ? buildRscCacheKey(spaceId, environment, revision, req.ctx.user?.id, idsParam, req)
      : undefined;
  const cached = cacheKey ? cache?.get(cacheKey) : undefined;

  // An RSC read is a server request of its own — a partial refresh the page asks for after it loaded — so it
  // is metered like one, at whatever a deployment prices a data refresh against a whole page. Before the
  // cache lookup and on both branches, for the same reason page renders are: a response served from cache is
  // still a response served.
  if (!previewing) {
    await meterRsc(req, config, spaceId, environment, revision, !!cached);
  }

  if (cached) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Cache', 'HIT');
    res.send(cached);

    return;
  }

  let rscData: SSRRscData;
  try {
    rscData = await config.adapters.getRscData({
      req: pageRequest,
      spaceId,
      environment,
      revision,
      user: req.ctx.user,
      ids,
      // No page render alongside this one, so the loader has nothing to join — it is here so an adapter reads the
      // same way on both paths, and still never fetches the space twice within the one request.
      loadOfflineData: createOfflineDataLoader(() => config.adapters.getOfflineData(spaceId, environment, revision))
    });
  } catch (err) {
    console.error('[RSC] getRscData error:', err);
    res.setStatus(500);
    res.send(JSON.stringify({ error: 'RSC data fetch failed' }));

    return;
  }

  const payload: RscPayload = {
    version: 1,
    transport: 'json',
    spaceId,
    environment,
    revision,
    ...rscData
  };

  const payloadStr = JSON.stringify(payload);
  if (cacheKey) {
    cache?.set(cacheKey, payloadStr);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Cache', 'MISS');
  res.send(payloadStr);
};
