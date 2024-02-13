export const getEnvironmentServer = (env, server) => {
  switch (env) {
    case 'production': {
      return {
        // Dashboard
        apiServer: 'https://api.plitzi.com',
        ssrServer: 'https://ssr.plitzi.com',
        // SDK
        basePath: '/',
        host: 'https://plitzi.com',
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
        basePath: '/',
        host: 'https://stg.plitzi.com',
        nodeServer: 'https://server-stg.plitzi.com',
        graphqlServer: 'https://server-stg.plitzi.com/graphql',
        websocketServer: 'wss://server-stg.plitzi.com',
        subscriptionServer: 'wss://server-stg.plitzi.com/subscriptions',
        ...server
      };
    }

    default:
      return {
        // Dashboard
        apiServer: 'http://localhost',
        ssrServer: 'http://localhost:4000',
        // SDK
        basePath: '/',
        host: 'http://localhost',
        nodeServer: 'http://localhost:8888',
        graphqlServer: 'http://localhost:8888/graphql',
        websocketServer: 'ws://localhost:8888',
        subscriptionServer: 'ws://localhost:8888/subscriptions',
        ...server
      };
  }
};
