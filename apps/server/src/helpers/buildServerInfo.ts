import { resolveRscEndpoint } from '../core/services/resolve';

import type { OfflineDataLoader } from './offlineDataLoader';
import type { Server, SSRRequest, SSRServerConfig } from '@plitzi/sdk-shared';

const getEnvironment = (env: string = 'production', server?: Record<string, unknown>): Server => {
  switch (env) {
    case 'production': {
      // the sdk and builder already have prod config defined
      return server as Server;
    }

    case 'staging': {
      return {
        // Dashboard
        apiServer: 'https://api-stg.plitzi.com',
        ssrServer: 'https://ssr-stg.plitzi.com',
        // SDK
        serverUrl: 'https://server-stg.plitzi.com',
        websocketServer: 'wss://server-stg.plitzi.com',
        subscriptionServer: 'wss://server-stg.plitzi.com/subscriptions',
        ...server
      };
    }

    case 'development': {
      return {
        // Dashboard
        apiServer: 'https://api-dev.plitzi.com',
        ssrServer: 'https://ssr-dev.plitzi.com',
        // SDK
        serverUrl: 'https://server-dev.plitzi.com',
        websocketServer: 'wss://server-dev.plitzi.com',
        subscriptionServer: 'wss://server-dev.plitzi.com/subscriptions',
        ...server
      };
    }

    default:
      // Local `yarn start` fronts every role with the dev gateway on :443, so each tier is its own
      // sub-domain with no port and no path — the same shape as dev/stg/prod. SSR keeps its own
      // server (own TLS/http2) on :4000.
      return {
        // Dashboard
        apiServer: 'https://api.plitzi.local',
        ssrServer: 'https://ssr.plitzi.local',
        // SDK
        serverUrl: 'https://server.plitzi.local',
        websocketServer: 'wss://server.plitzi.local',
        subscriptionServer: 'wss://server.plitzi.local/subscriptions',
        ...server
      };
  }
};

export const buildServerInfo = async (
  req: SSRRequest,
  config: SSRServerConfig,
  loadOfflineData: OfflineDataLoader
): Promise<Partial<Server>> => {
  const accessToken = req.query['access-token'];
  const origin = `${req.protocol}://${req.hostname}`;
  const user = req.ctx.user;
  const { environment = 'main', spaceId, revision = 0 } = req.ctx.spaceDeployment ?? {};

  return getEnvironment(config.environment, {
    basePath: '/',
    requestUrl: req.url || '/',
    origin,
    location: {
      hostname: req.hostname,
      pathname: req.path || '/',
      search: req.search
    },
    authenticated: !!user,
    skipAuth: !!accessToken,
    // The token is handed over beside the details rather than buried in them: the SDK stores it as the session's
    // credential, so a hydrated page can authenticate its own requests and renew before it lapses instead of
    // discovering the expiry through a refused call.
    user: user
      ? {
          details: {
            id: user.id,
            username: user.username,
            email: user.email,
            verified: user.verified,
            permissions: user.permissions,
            roles: user.roles
          },
          accessToken: user.token,
          expiresAt: user.expiresAt
        }
      : undefined,
    ssr: {
      rscPath: resolveRscEndpoint(config),
      rscData: await config.adapters.getRscData?.({
        req,
        spaceId: spaceId as number,
        environment,
        revision,
        user,
        loadOfflineData
      })
    }
  });
};
