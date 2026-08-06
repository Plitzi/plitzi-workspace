import { handleProxyRequest, proxySettings } from '../modules/mcp/proxy';

import type { Stage } from '@plitzi/sdk-server/kernel';

// The endpoint a rendered widget loads its images, media, fonts and API data from (see `mcpAi.proxy`). Inert
// unless the deployment configured a secret, and deliberately ahead of the OAuth guard: the host's sandboxed
// iframe fetches these with no credential of any kind — a 401 there is a picture that never paints. What stands
// in for a caller identity is the signed grant in the URL itself.
export const widgetProxyStage: Stage = async ctx => {
  const settings = proxySettings(ctx.config);
  if (!settings || ctx.req.path !== settings.path) {
    return false;
  }

  ctx.operation = 'proxy';
  await handleProxyRequest(ctx.req, ctx.res, settings);

  return true;
};
