import { handleRsc } from '../../modules/rsc/handler';

import type { SSRContext, Stage } from '../http/types';

// React Server Components endpoint. Only answers its configured path on GET; otherwise falls through to SSR.
export const rscStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  const rscPath = config.rsc?.path ?? '/_rsc';
  if (!(config.rsc?.enabled ?? true) || req.method !== 'GET' || req.path !== rscPath) {
    return false;
  }

  await handleRsc(req, ctx.res, config, ctx.pluginManager, ctx.caches.rsc);

  return true;
};
