import { serverLog } from '../../../helpers/serverLog';

import type { BaseContext } from '../types';

/**
 * The deployment the request's host resolves to, for a stage that writes cookies before the middlewares resolve it:
 * how they are written depends on it (a domain other sites frame writes them `SameSite=None`, `sessionCookieParams`).
 * Asked only by a stage about to write one — a sign-in, a renewal — and read from the resolution's cache by host.
 * A host that resolves to nothing, or fails to, writes them as the server says.
 */
export const knowHostDeployment = async ({ req, config }: Pick<BaseContext, 'req' | 'config'>): Promise<void> => {
  if (req.ctx.spaceDeployment || !config.adapters.getSpaceDeployment) {
    return;
  }

  try {
    const deployment = await config.adapters.getSpaceDeployment(req);
    if (!deployment.error) {
      req.ctx.spaceDeployment = deployment;
    }
  } catch (error) {
    serverLog.warn(
      'auth',
      `What ${req.hostname} serves could not be resolved: its cookies are written as the server says`,
      error
    );
  }
};
