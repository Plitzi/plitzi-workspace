import type { Server, ServerEnvironment } from '@plitzi/sdk-shared';

export const getEnvironmentServer = (
  env: ServerEnvironment,
  server?: Partial<Omit<Server, 'ssrServer' | 'location'>>
): Omit<Server, 'ssrServer' | 'location'> => {
  switch (env) {
    case 'production': {
      return {
        // Dashboard
        apiServer: 'https://api.plitzi.com',
        ssrServer: 'https://ssr.plitzi.com',
        // SDK
        nodeServer: 'https://server.plitzi.com',
        graphqlServer: 'https://server.plitzi.com/graphql',
        websocketServer: 'wss://server.plitzi.com',
        subscriptionServer: 'wss://server.plitzi.com/subscriptions',
        ...server
      };
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
        apiServer: 'http://localhost',
        ssrServer: 'http://localhost:4000',
        // SDK
        nodeServer: 'http://localhost:8888',
        graphqlServer: 'http://localhost:8888/graphql',
        websocketServer: 'ws://localhost:8888',
        subscriptionServer: 'ws://localhost:8888/subscriptions',
        ...server
      };
  }
};
