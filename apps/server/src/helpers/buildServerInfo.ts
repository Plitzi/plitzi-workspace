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
        nodeServer: 'https://server-stg.plitzi.com',
        aiServer: 'https://mcp-stg.plitzi.com',
        graphqlServer: 'https://server-stg.plitzi.com',
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
        nodeServer: 'https://server-dev.plitzi.com',
        aiServer: 'https://mcp-dev.plitzi.com',
        graphqlServer: 'https://server-dev.plitzi.com',
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
        nodeServer: 'https://server.plitzi.local',
        aiServer: 'https://mcp.plitzi.local',
        graphqlServer: 'https://server.plitzi.local',
        websocketServer: 'wss://server.plitzi.local',
        subscriptionServer: 'wss://server.plitzi.local/subscriptions',
        ...server
      };
  }
};

export const buildServerInfo = async (req: SSRRequest, config: SSRServerConfig): Promise<Partial<Server>> => {
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
    user: user ? { details: user } : undefined,
    rscData: await config.adapters.getRscData?.(req, spaceId as number, environment, revision, user)
  });
};
