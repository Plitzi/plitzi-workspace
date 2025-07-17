import { createContext } from 'react';

import type Mutations from './Mutations';
import type Queries from './Queries';
import type { FetchPolicy } from '@apollo/client/core';

export type NetworkContextValue = {
  mutate: <T = unknown>(
    mutationKey: keyof typeof Mutations,
    variables: Record<string, unknown>,
    silentError?: boolean,
    includeEnvironment?: boolean,
    uploadOptions?: object
  ) => Promise<T>;
  query: <T = unknown>(
    queryKey: keyof typeof Queries,
    variables?: Record<string, unknown>,
    fetchPolicy?: FetchPolicy,
    silentError?: boolean
  ) => Promise<T>;
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
} as NetworkContextValue;

const NetworkContext = createContext(networkContextDefaultValue);

export default NetworkContext;
