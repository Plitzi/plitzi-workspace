import { forcedFlagsFromCookies } from '@plitzi/sdk-shared/flags';

import { readDraftToken } from '../../core/previewToken';
import { buildRscCacheKey, DEFAULT_TTL_MS } from '../../helpers/cache';
import { resolveDebugAuthorization } from '../../helpers/debugAuthorization';
import { requestFlagOverrides } from '../../helpers/flagOverrides';
import { createOfflineDataLoader } from '../../helpers/offlineDataLoader';
import { serverLog } from '../../helpers/serverLog';

import type { TtlCache } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type {
  ActionRunSummary,
  Environment,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRRscData
} from '@plitzi/sdk-shared';

/** Payload returned by the /_rsc endpoint. */
type RscPayload = {
  version: 1;
  transport: 'json';
  spaceId: number;
  environment: Environment;
  revision: number;
  /** The runs this refresh started, for a page whose debugging is authorized. */
  actionRuns?: ActionRunSummary[];
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

/** The endpoint's own parameters: what it is asked about, never input to what it resolves. */
const ENDPOINT_PARAMS = new Set(['location', 'ids']);

/**
 * Rewrites the request to the page the browser is actually on.
 *
 * A refresh is issued against `/_rsc`, not against `/blog/my-post`, so resolving straight from `req.path` matches
 * nothing in `schema.pages` and every client-side refresh silently returns no data. The SDK sends the visitor's
 * location as `?location=`, and route params plus the page parameter are read from that instead.
 *
 * What a refresh asks for besides — the next page of a "load more", a search a provider was reloaded with — rides on
 * the query string beside `location`, and is read over the location's own query. It used to be dropped with the rest
 * of the endpoint's query, so a provider paged in place was answered its first page every time.
 *
 * Reflecting both is safe by construction: the location is matched against this space's own page list, and the rest
 * is what the same visitor could have put in the page's own address; the cache key is the whole request, so no answer
 * is served for a query it was not made for.
 */
export const withPageLocation = (req: SSRRequest): SSRRequest => {
  const location = req.query.location;
  if (!location || !location.startsWith('/') || location.length > MAX_PAGE_LOCATION) {
    return req;
  }

  const url = new URL(location, `${req.protocol}://${req.hostname}`);
  const asked = Object.entries(req.query).filter(([key]) => !ENDPOINT_PARAMS.has(key));
  const query = Object.fromEntries([...url.searchParams.entries(), ...asked]);
  const search = new URLSearchParams(query).toString();

  return {
    ...req,
    path: url.pathname,
    search: search ? `?${search}` : '',
    url: `${url.pathname}${search ? `?${search}` : ''}`,
    query
  };
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
  /**
   * A tester forcing flags from the dev tools sees data for features nobody else has on — and must never be handed a
   * slice resolved without them. Their refreshes go around the cache both ways, like a draft's.
   */
  const forcingFlags = Object.keys(forcedFlagsFromCookies(req.headers.cookie, req.headers.host)).length > 0;
  const uncached = previewing || forcingFlags;

  const ttlMs = config.rsc?.cacheTtlMs ?? DEFAULT_TTL_MS.rsc;
  const isAuthenticated = !!req.ctx.user;
  const cacheControl =
    environment === 'main' || uncached
      ? 'no-store'
      : isAuthenticated
        ? `private, max-age=${Math.floor(ttlMs / 1000)}`
        : `public, max-age=${Math.floor(ttlMs / 1000)}`;

  // main is the development environment — never cache it.
  const cacheKey =
    environment !== 'main' && !uncached
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

  // No page render alongside this one, so the loader has nothing to join — it is here so an adapter reads the same way
  // on both paths, and so the debugging check below reads the space the adapter already fetched rather than again.
  const loadOfflineData = createOfflineDataLoader(() => config.adapters.getOfflineData(spaceId, environment, revision));

  const settings = async () => (await loadOfflineData())?.schema.settings;
  const flagOverrides = await requestFlagOverrides(config, req, { spaceId, environment }, () =>
    resolveDebugAuthorization(config, settings)
  );

  let rscData: SSRRscData;
  try {
    rscData = await config.adapters.getRscData({
      req: pageRequest,
      spaceId,
      environment,
      revision,
      user: req.ctx.user,
      ids,
      loadOfflineData,
      flagOverrides
    });
  } catch (err) {
    serverLog.error('RSC', 'getRscData error', err);
    res.setStatus(500);
    res.send(JSON.stringify({ error: 'RSC data fetch failed' }));

    return;
  }

  // The runs this refresh started, for a page whose debugging this deployment authorized — a dev server, or a space
  // that switched dev tools on for its own site. An answer carrying them is this request's alone, so it is never
  // kept for the next visitor.
  const debuggable = Boolean(req.ctx.actionRuns?.length) && (await resolveDebugAuthorization(config, settings));
  const actionRuns = debuggable ? req.ctx.actionRuns : undefined;

  const payload: RscPayload = {
    version: 1,
    transport: 'json',
    spaceId,
    environment,
    revision,
    ...rscData,
    ...(actionRuns ? { actionRuns } : {})
  };

  const payloadStr = JSON.stringify(payload);
  if (cacheKey && !actionRuns?.length) {
    cache?.set(cacheKey, payloadStr);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Cache', 'MISS');
  res.send(payloadStr);
};
