import { runMiddlewares } from '../../../helpers/runMiddlewares';
import { authMiddleware } from '../../../middlewares/auth';
import { basicAuthMiddleware } from '../../../middlewares/basicAuth';
import { spaceDeploymentMiddleware } from '../../../middlewares/spaceDeployment';

import type { SSRContext, Stage } from '../types';
import type { SSRMiddleware } from '@plitzi/sdk-shared';

// Auth/deployment middleware chain that guards the data-serving services (RSC, SSR). Runs after the static and
// MCP stages — MCP does its own token auth — and stops the pipeline if any middleware answers or errors. Typed to
// the page context because resolving the space deployment is a page adapter: a server without one serves no page
// for this to guard.
//
// A factory, and the chain built ONCE per server: middlewares hold state across requests. Built inside the stage it
// was rebuilt on every request, and `basicAuthMiddleware` starts a cache with a sweep timer — so each request left a
// cache behind that its timer kept alive for good (about a kilobyte a request, until the process ran out of memory),
// and the credential cache it was meant to be started empty every time.
export const createMiddlewaresStage = (): Stage<SSRContext> => {
  let built: { config: SSRContext['config']; chain: SSRMiddleware[] } | undefined;

  return async ctx => {
    const { config, req, res } = ctx;
    if (built?.config !== config) {
      built = {
        config,
        chain: [
          spaceDeploymentMiddleware(config.adapters),
          basicAuthMiddleware({ cacheTtlMs: config.cacheTtlMs }),
          authMiddleware(config.adapters),
          ...(config.middlewares || [])
        ]
      };
    }

    const stopped = await runMiddlewares(built.chain, req, res);

    return stopped || res.status !== 200;
  };
};
