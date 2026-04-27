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
        graphqlServer: 'https://server-stg.plitzi.com/graphql',
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
        graphqlServer: 'https://server-dev.plitzi.com/graphql',
        websocketServer: 'wss://server-dev.plitzi.com',
        subscriptionServer: 'wss://server-dev.plitzi.com/subscriptions',
        ...server
      };
    }

    default:
      return {
        // Dashboard
        apiServer: 'https://api.plitzi.local',
        ssrServer: 'https://ssr.plitzi.local:4000',
        // SDK
        nodeServer: 'https://server.plitzi.local:8888',
        graphqlServer: 'https://server.plitzi.local:8888/graphql',
        websocketServer: 'wss://server.plitzi.local:8888',
        subscriptionServer: 'wss://server.plitzi.local:8888/subscriptions',
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
