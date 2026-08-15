import { handleAction } from '../../modules/actions/handler';
import { readRawBody } from '../requestParser';

import type { ConnectorLookups } from '../../modules/connectors/resolver';
import type { SSRContext, Stage } from '../http/types';

/**
 * Write endpoint for server-driven providers. RSC is read-only, so this is the only path a page has to mutate a
 * connected backend — and it answers POST on its own path alone, never falling through to SSR.
 *
 * Inert unless the consumer supplied the connector lookups: without them there is no manifest to authorize a
 * write against, and guessing would be the whole vulnerability.
 */
export const actionStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  const actionPath = config.action?.path ?? '/_action';
  if (!config.connectors || req.method !== 'POST' || req.path !== actionPath) {
    return false;
  }

  ctx.operation = 'action';
  req.body = await readRawBody(ctx.raw);
  // The shared config types the lookups structurally (they return `unknown`) so sdk-shared stays free of the
  // connector internals; the manifest shape is this package's contract, and this is the single seam between them.
  await handleAction(req, ctx.res, config, config.connectors as ConnectorLookups);

  return true;
};
