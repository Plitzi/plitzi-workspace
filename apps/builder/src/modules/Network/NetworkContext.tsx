/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

import type Mutations from './Mutations';
import type Queries from './Queries';
import type Subscriptions from './Subscriptions';
import type { ApolloError, FetchPolicy, FetchResult, Observable } from '@apollo/client/core';
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
  subscriptionManager: {
    subscribe: (
      subscriptionKey: keyof typeof Subscriptions,
      variables: Record<string, unknown>,
      callback: (result: FetchResult) => void
    ) => false | Observable<FetchResult<any>> | null;
    unsubscribe: (subscriptionKey: keyof typeof Subscriptions | (keyof typeof Subscriptions)[]) => void;
    stop: () => void;
  };
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
  subscriptionManager: {
    subscribe: () => {},
    unsubscribe: () => {},
    stop: () => {}
  },
  webKey: '',
  instanceId: '',
  server: {} as NetworkContextValue['server'],
  userKey: '',
  webId: '',
  environment: 'development'
} as unknown as NetworkContextValue;

const NetworkContext = createContext<NetworkContextValue>(networkContextDefaultValue);

export default NetworkContext;
