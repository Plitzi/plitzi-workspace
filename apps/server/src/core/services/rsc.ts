import { resolveRscEndpoint } from './resolve';
import { handleRsc } from '../../modules/rsc/handler';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';

// React Server Components endpoint. Only answers its configured path on GET; otherwise falls through to SSR.
export const rscStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  const rscPath = resolveRscEndpoint(config);
  if (!rscPath || req.method !== 'GET' || req.path !== rscPath) {
    return false;
  }

  // Names itself in the access log: RSC rides the same server as the pages, so without this a consumer could only
  // tell the two apart by matching the configured path.
  ctx.operation = 'rsc';
  await handleRsc(req, ctx.res, config, ctx.pluginManager, ctx.caches.rsc, ctx.signal);

  return true;
};
