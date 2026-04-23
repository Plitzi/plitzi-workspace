import type { PluginManager } from '../../plugins/manager';
import type { SSRRequest, SSRResponseHelpers, SSRRscData, SSRServerConfig } from '../../types';
import type { Environment } from '@plitzi/sdk-shared';

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
  _pluginManager: PluginManager
): Promise<void> => {
  if (!config.adapters.getRscData) {
    res.setStatus(501);
    res.send(JSON.stringify({ error: 'getRscData adapter not configured' }));

    return;
  }

  const { environment = 'main', spaceId = 1, revision = 0 } = req.ctx.spaceDeployment ?? {};

  let rscData: SSRRscData;
  try {
    rscData = await config.adapters.getRscData(req, spaceId as number, environment as Environment, revision);
  } catch (err) {
    console.error('[RSC] getRscData error:', err);
    res.setStatus(500);
    res.send(JSON.stringify({ error: 'RSC data fetch failed' }));

    return;
  }

  const payload: RscPayload = {
    version: 1,
    transport: 'json',
    spaceId: spaceId as number,
    environment: environment as Environment,
    revision,
    ...rscData
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
};
