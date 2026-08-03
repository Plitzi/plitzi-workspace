import { writeConnectorRecord } from '../connectors/engine';

import type { ConnectorLookups } from '../connectors/resolver';
import type { ConnectorWriteAction } from '../connectors/types';
import type { SSRRequest, SSRResponseHelpers, SSRServerConfig } from '@plitzi/sdk-shared';

const WRITE_ACTIONS: ConnectorWriteAction[] = ['create', 'update', 'delete'];

type ActionRequest = {
  elementId?: string;
  action?: string;
  recordId?: string;
  values?: Record<string, unknown>;
};

type ProviderAttributes = { connector?: string; resource?: string };

const parseBody = (body: string | undefined): ActionRequest | undefined => {
  if (!body) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(body);

    return parsed !== null && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const fail = (res: SSRResponseHelpers, status: number, error: string) => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify({ error }));
};

/**
 * Handles POST /_action — the write counterpart of the RSC read endpoint.
 *
 * The browser names an **element**, never a connector or a URL. The element must exist in the published schema,
 * be server-driven and declare a connector, and the connector must declare the action. That chain is what stops
 * the endpoint from being a general-purpose proxy into the customer's backend: nothing reachable here is
 * reachable that the page itself does not already do.
 */
export const handleAction = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRServerConfig,
  lookups: ConnectorLookups
): Promise<void> => {
  const { environment = 'main', spaceId, revision = 0 } = req.ctx.spaceDeployment ?? {};
  if (typeof spaceId !== 'number') {
    fail(res, 400, 'Invalid space deployment');

    return;
  }

  const body = parseBody(req.body);
  const action = body?.action as ConnectorWriteAction | undefined;
  if (!body?.elementId || !action || !WRITE_ACTIONS.includes(action)) {
    fail(res, 400, 'Expected { elementId, action, values }');

    return;
  }

  const offlineData = await config.adapters.getOfflineData(spaceId, environment, revision);
  const element = offlineData?.schema.flat[body.elementId];
  if (!element || element.definition.runtime !== 'server') {
    fail(res, 404, 'Unknown provider element');

    return;
  }

  const { connector: connectorId, resource } = element.attributes as ProviderAttributes;
  if (!connectorId) {
    fail(res, 400, 'Element has no connector');

    return;
  }

  const manifest = await lookups.getConnector(spaceId, connectorId);
  if (!manifest) {
    fail(res, 404, 'Unknown connector');

    return;
  }

  if (!manifest.write?.[action]) {
    fail(res, 405, `Connector does not allow "${action}"`);

    return;
  }

  const credential =
    manifest.credential && lookups.getCredential
      ? await lookups.getCredential(spaceId, manifest.credential)
      : undefined;

  try {
    const record = await writeConnectorRecord({
      manifest,
      credential,
      action,
      resource,
      recordId: body.recordId,
      values: body.values,
      fetchImpl: lookups.fetchImpl
    });

    res.setStatus(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Writes must never be cached: the response reflects a mutation the visitor just made.
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify({ record: record ?? null }));
  } catch (err) {
    console.error('[Action] connector write failed:', err);
    // The provider's own message can carry its URL or internal details, so the browser gets a flat failure.
    fail(res, 502, 'Connector write failed');
  }
};
