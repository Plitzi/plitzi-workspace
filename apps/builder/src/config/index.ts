import type { Server } from '@plitzi/sdk-shared';

export const getEnvironmentServer = (server?: Partial<Server>): Server => {
  const config = {
    // Dashboard
    apiServer: 'https://api.plitzi.com',
    ssrServer: 'https://ssr.plitzi.com',
    // SDK
    basePath: '',
    host: 'https://plitzi.com',
    nodeServer: 'https://server.plitzi.com',
    aiServer: 'https://server.plitzi.com',
    graphqlServer: 'https://server.plitzi.com/graphql',
    websocketServer: 'wss://server.plitzi.com',
    subscriptionServer: 'wss://server.plitzi.com/subscriptions',
    // Others
    location: undefined,
    ...server
  };

  if (config.basePath === '/') {
    config.basePath = '';
  } else if (config.basePath) {
    config.basePath = config.basePath.replaceAll('//', '/');
  }

  return config;
};

// Experimental Functionality Flag
// @todo: make this based on the user later and add launchDarkly
const featureFlag = {
  assistanceAI: false
};

export { featureFlag };
