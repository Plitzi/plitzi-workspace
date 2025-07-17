import { createContext } from 'react';

import type Mutations from './Mutations';

export type NetworkContextValue = {
  mutate: (
    mutationKey: keyof typeof Mutations,
    variables: Record<string, unknown>,
    silentError?: boolean,
    includeEnvironment?: boolean,
    uploadOptions?: object
  ) => Promise<unknown>;
  query: () => Promise<void>;
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
  mutate: async () => {},
  query: async () => {},
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
