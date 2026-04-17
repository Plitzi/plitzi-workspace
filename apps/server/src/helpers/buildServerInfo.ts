import type { SSRRequest } from '../types';
import type { Server } from '@plitzi/sdk-shared';

/**
 * Build the `Server` object that is passed down to the React component and
 * serialised into the page's inline JSON for client-side hydration.
 *
 * Mirrors the shape produced by `getServer()` in the original Express-based
 * SSR service.
 */
export const buildServerInfo = (req: SSRRequest): Partial<Server> => {
  const accessToken = req.query['access-token'];
  const origin = `${req.protocol}://${req.hostname}`;

  return {
    basePath: '/',
    requestUrl: req.url || '/',
    origin,
    location: {
      hostname: req.hostname,
      pathname: req.path || '/',
      search: req.search
    } as Location,
    authenticated: false,
    skipAuth: !!accessToken,
    user: undefined
  };
};
