import { createContext } from 'react';

import type Mutations from './Mutations';
import type Queries from './Queries';
import type { ApolloError, FetchPolicy } from '@apollo/client/core';
import type { Server, ServerEnvironment } from '@plitzi/sdk-shared';

export type NetworkContextValue = {
  mutate: <T = unknown>(
    mutationKey: keyof typeof Mutations,
    variables: Record<string, unknown>,
    silentError?: boolean,
    includeEnvironment?: boolean,
    uploadOptions?: object
  ) => Promise<T | ApolloError | undefined | null>;
  query: <T = unknown>(
    queryKey: keyof typeof Queries,
    variables?: Record<string, unknown>,
    fetchPolicy?: FetchPolicy,
    silentError?: boolean
  ) => Promise<T | ApolloError | undefined | null>;
  // subscribe: () => void;
  subscriptionManager: unknown;
  webKey: string;
  instanceId: string;
  server: Server;
  userKey: string;
  webId: string;
  environment: ServerEnvironment;
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
  environment: 'development'
} as NetworkContextValue;

const NetworkContext = createContext(networkContextDefaultValue);

export default NetworkContext;
