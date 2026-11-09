import { renderSSR } from '../../modules/ssr/handler';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';

// Terminal stage: renders the page. Always answers, so it sits last in the pipeline.
export const ssrStage: Stage<SSRContext> = async ctx => {
  await renderSSR(ctx.req, ctx.res, ctx.config, ctx.renderFn, ctx.pluginManager, ctx.caches, ctx.engine?.published);

  return true;
};

// Fallback when SSR is disabled and no earlier stage matched.
export const notFoundStage: Stage = ctx => {
  ctx.res.setStatus(404);
  ctx.res.end();

  return true;
};
