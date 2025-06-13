// Packages
import { createContext } from 'react';

export type NetworkContextValue = {
  mutate: () => void;
  query: () => void;
  subscribe: () => void;
  subscriptionManager: unknown;
  webKey: string;
  instanceId: string;
  server: {
    // Dashboard
    apiServer: string;
    ssrServer: string;
    // SDK
    basePath: string;
    host: string;
    nodeServer: string;
    graphqlServer: string;
    websocketServer: string;
    subscriptionServer: string;
  } & Record<string, string>;
  userKey: string;
  webId: string;
  environment: string;
};

const networkContextDefaultValue: NetworkContextValue = {
  mutate: () => {},
  query: () => {},
  subscribe: () => {},
  subscriptionManager: {},
  webKey: '',
  instanceId: '',
  server: {} as NetworkContextValue['server'],
  userKey: '',
  webId: '',
  environment: ''
};

const NetworkContext = createContext(networkContextDefaultValue);

export default NetworkContext;
