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
 * A future 'stream' transport will use the RSC wire protocol via
 * react-server-dom-esm (requires --conditions=react-server).
 */
export const handleRsc = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRServerConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pluginManager: PluginManager
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

  const idsParam = req.query.ids;
  const ids = idsParam ? idsParam.split(',').filter(Boolean) : undefined;

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
    environment: environment,
    revision,
    ...rscData
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
};
