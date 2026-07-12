import type { Server } from '@plitzi/sdk-shared';

export const getEnvironmentServer = (server?: Partial<Server>): Server => {
  return {
    // Dashboard
    apiServer: 'https://api.plitzi.com',
    ssrServer: 'https://ssr.plitzi.com',
    // SDK
    serverUrl: 'https://server.plitzi.com',
    websocketServer: 'wss://server.plitzi.com',
    subscriptionServer: 'wss://server.plitzi.com/subscriptions',
    ...server
  };
};
