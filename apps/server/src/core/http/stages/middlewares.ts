import { runMiddlewares } from '../../../helpers/runMiddlewares';
import { authMiddleware } from '../../../middlewares/auth';
import { basicAuthMiddleware } from '../../../middlewares/basicAuth';
import { spaceDeploymentMiddleware } from '../../../middlewares/spaceDeployment';

import type { Stage } from '../types';

// Auth/deployment middleware chain that guards the data-serving services (RSC, SSR). Runs after the static and
// MCP stages — MCP does its own token auth — and stops the pipeline if any middleware answers or errors.
export const middlewaresStage: Stage = async ctx => {
  const { config, req, res } = ctx;
  const middlewares = [
    spaceDeploymentMiddleware(config.adapters),
    basicAuthMiddleware({ cacheTtlMs: config.cacheTtlMs }),
    authMiddleware(config.adapters),
    ...(config.middlewares || [])
  ];

  const stopped = await runMiddlewares(middlewares, req, res);

  return stopped || res.status !== 200;
};
