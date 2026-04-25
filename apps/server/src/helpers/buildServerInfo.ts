import type { Server, SSRRequest, SSRServerConfig } from '@plitzi/sdk-shared';

export const buildServerInfo = async (req: SSRRequest, config: SSRServerConfig): Promise<Partial<Server>> => {
  const accessToken = req.query['access-token'];
  const origin = `${req.protocol}://${req.hostname}`;
  const user = req.ctx.user;
  const { environment = 'main', spaceId, revision = 0 } = req.ctx.spaceDeployment ?? {};

  return {
    basePath: '/',
    requestUrl: req.url || '/',
    origin,
    location: {
      hostname: req.hostname,
      pathname: req.path || '/',
      search: req.search
    } as Location,
    authenticated: !!user,
    skipAuth: !!accessToken,
    user: user ? { details: user } : undefined,
    rscData: await config.adapters.getRscData?.(req, spaceId as number, environment, revision, user)
  };
};
