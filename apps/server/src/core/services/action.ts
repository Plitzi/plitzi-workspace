import { handleActionCall, handleActionCancel, handleActionCatalog } from '../../modules/actions';
import { handleAction } from '../../modules/actions/connectorWrite';
import { clientIp, readRawBody } from '../requestParser';

import type { ConnectorLookups } from '../../modules/connectors/resolver';
import type { SSRContext, Stage } from '../http/types';
import type { SSRRequest } from '@plitzi/sdk-shared';

const LINEAGE_HEADER = 'x-plitzi-action-lineage';

const safeParse = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Who is asking, for the single-flight key and for cancellation ownership.
 *
 * A signed-in visitor is themselves; anyone else is their address. The address is a coarse identity — a shared
 * NAT makes two visitors look like one, which single-flight would read as a duplicate — so it is only ever used
 * for a `public` action, and the derived key also folds in the input: two people submitting different forms do
 * not collide.
 */
const callerIdOf = (ctx: SSRContext, req: SSRRequest): string =>
  req.ctx.user ? `user:${req.ctx.user.id}` : `ip:${clientIp(ctx.raw, req)}`;

const lineageOf = (req: SSRRequest): string[] => {
  const raw = req.headers[LINEAGE_HEADER];
  const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
};

/**
 * The action endpoint: server-driven provider writes, and server actions.
 *
 * Two addressing modes on one path, because both are "the browser asks the server to change something, naming it
 * rather than addressing it". An element-addressed body reaches a connector's declared write; an action-addressed
 * one runs a stored flow. Each mode is inert unless its own half of the config is present, so a deployment that
 * configures neither has no endpoint at all — and guessing what an unconfigured one should do would be the whole
 * vulnerability.
 */
export const actionStage: Stage<SSRContext> = async ctx => {
  const { config, req, actions } = ctx;
  const actionPath = config.action?.path ?? '/_action';
  const hasConnectors = !!config.connectors;
  if (!hasConnectors && !actions) {
    return false;
  }

  // Behind the auth middleware like the rest of this stage, so the catalog is never anonymous: it names what this
  // deployment can do server-side, which is not a visitor's business.
  if (actions && req.method === 'GET' && req.path === `${actionPath}/catalog`) {
    ctx.operation = 'action:catalog';
    if (!req.ctx.user) {
      ctx.res.setStatus(401);
      ctx.res.send('');

      return true;
    }

    handleActionCatalog({ res: ctx.res, module: actions });

    return true;
  }

  if (actions && req.method === 'DELETE' && req.path.startsWith(`${actionPath}/run/`)) {
    ctx.operation = 'action:cancel';
    handleActionCancel({
      res: ctx.res,
      module: actions,
      runId: req.path.slice(`${actionPath}/run/`.length),
      callerId: callerIdOf(ctx, req)
    });

    return true;
  }

  if (req.method !== 'POST' || req.path !== actionPath) {
    return false;
  }

  req.body = await readRawBody(ctx.raw);
  const body: unknown = req.body ? safeParse(req.body) : undefined;
  const addressesAction = body !== undefined && typeof body === 'object' && body !== null && 'actionId' in body;

  if (addressesAction && actions) {
    ctx.operation = 'action:run';
    await handleActionCall({
      req,
      res: ctx.res,
      config,
      module: actions,
      signal: ctx.signal,
      callerId: callerIdOf(ctx, req),
      lineage: lineageOf(req)
    });

    return true;
  }

  if (addressesAction || !hasConnectors) {
    ctx.operation = 'action';
    ctx.res.setStatus(404);
    ctx.res.setHeader('Content-Type', 'application/json; charset=utf-8');
    ctx.res.send(JSON.stringify({ error: 'This server runs no actions', reason: 'not_found' }));

    return true;
  }

  ctx.operation = 'action';
  // The shared config types the lookups structurally (they return `unknown`) so sdk-shared stays free of the
  // connector internals; the manifest shape is this package's contract, and this is the single seam between them.
  await handleAction(req, ctx.res, config, config.connectors as ConnectorLookups);

  return true;
};
