import { buildRscCacheKey, DEFAULT_TTL_MS } from '../../helpers/cache';

import type { TtlCache } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { Environment, SSRRequest, SSRResponseHelpers, SSRRscData, SSRServerConfig } from '@plitzi/sdk-shared';

/** Payload returned by the /_rsc endpoint. */
type RscPayload = {
  version: 1;
  transport: 'json';
  spaceId: number;
  environment: Environment;
  revision: number;
} & SSRRscData;

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
  config: SSRServerConfig,

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

  const ttlMs = config.rsc?.cacheTtlMs ?? DEFAULT_TTL_MS.rsc;
  const isAuthenticated = !!req.ctx.user;
  const cacheControl =
    environment === 'main'
      ? 'no-store'
      : isAuthenticated
        ? `private, max-age=${Math.floor(ttlMs / 1000)}`
        : `public, max-age=${Math.floor(ttlMs / 1000)}`;

  // main is the development environment — never cache it.
  const cacheKey =
    environment !== 'main' ? buildRscCacheKey(spaceId, environment, revision, req.ctx.user?.id, idsParam) : undefined;
  const cached = cacheKey ? cache?.get(cacheKey) : undefined;
  if (cached) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Cache', 'HIT');
    res.send(cached);

    return;
  }

  let rscData: SSRRscData;
  try {
    rscData = await config.adapters.getRscData(req, spaceId, environment, revision, req.ctx.user, ids);
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
