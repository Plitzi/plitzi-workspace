import { spaceDeploymentMiddleware } from '../../deployment/spaceDeployment';
import { authMiddleware } from '../middlewares/auth';
import { basicAuthMiddleware } from '../middlewares/basicAuth';
import { runMiddlewares } from '../runMiddlewares';

import type { DeployedContext } from '../../deployment/spaceDeployment';
import type { SSRMiddleware } from '../../types';
import type { Stage } from '../types';

// Auth/deployment middleware chain that guards the data-serving services (RSC, SSR). Runs after the static and
// MCP stages — MCP does its own token auth — and stops the pipeline if any middleware answers or errors. Typed to
// a server that serves spaces by their host: one without the deployment adapter has no space for this to guard.
//
// A factory, and the chain built ONCE per server: middlewares hold state across requests. Built inside the stage it
// was rebuilt on every request, and `basicAuthMiddleware` starts a cache with a sweep timer — so each request left a
// cache behind that its timer kept alive for good (about a kilobyte a request, until the process ran out of memory),
// and the credential cache it was meant to be started empty every time.
export const createMiddlewaresStage = (): Stage<DeployedContext> => {
  let built: { config: DeployedContext['config']; chain: SSRMiddleware[]; names: string[] } | undefined;

  return async ctx => {
    const { config, req, res } = ctx;
    if (built?.config !== config) {
      built = {
        config,
        chain: [
          spaceDeploymentMiddleware(config.adapters, config),
          basicAuthMiddleware({ cacheTtlMs: config.cacheTtlMs }),
          authMiddleware(config.adapters),
          ...(config.middlewares || [])
        ],
        // As `Server-Timing` names them: the deployment's own by their function's name, else their place.
        names: [
          'deployment',
          'basicAuth',
          'auth',
          ...(config.middlewares ?? []).map((middleware, index) => middleware.name || `middleware${String(index + 1)}`)
        ]
      };
    }

    const { names } = built;
    const stopped = await runMiddlewares(
      built.chain,
      req,
      res,
      config.devMode
        ? (index, ms) => {
            req.ctx.timings = [...(req.ctx.timings ?? []), { name: names[index], dur: Math.round(ms) }];
          }
        : undefined
    );

    return stopped || res.status !== 200;
  };
};
