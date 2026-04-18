import type { SSRRequest, SSRContext } from '../types';
import type { Server } from '@plitzi/sdk-shared';

export const buildServerInfo = (req: SSRRequest, ctx?: SSRContext): Partial<Server> => {
  const accessToken = req.query['access-token'];
  const origin = `${req.protocol}://${req.hostname}`;
  const user = ctx?.user;

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
    user: user ? { details: user } : undefined
  };
};
