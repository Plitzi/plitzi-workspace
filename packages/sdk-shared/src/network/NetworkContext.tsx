/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from 'react';

import type { Server, ServerEnvironment } from '../types';
import type { ApolloClient, ApolloLink, FetchPolicy, Observable } from '@apollo/client/core';

type NetworkContextValueBase<
  Q extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>
> = {
  mutate: <T extends keyof M>(
    mutationKey: T,
    variables: Record<string, unknown>,
    silentError?: boolean,
    includeEnvironment?: boolean,
    uploadOptions?: object
  ) => Promise<M[T]>;
  query: <T extends keyof Q>(
    queryKey: T,
    variables?: Record<string, unknown>,
    fetchPolicy?: FetchPolicy,
    silentError?: boolean
  ) => Promise<Q[T]>;
  webKey: string;
  instanceId: string;
  server: Server;
  userKey: string;
  webId: string;
  environment: ServerEnvironment;
};

export type NetworkContextValueBuilder<
  Q extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>
> = NetworkContextValueBase<Q, M> & {
  subscriptionManager: {
    subscribe: (
      subscriptionKey: keyof S,
      variables: Record<string, unknown>,
      callback: (result: ApolloClient.SubscribeResult) => void
    ) => false | Observable<ApolloLink.Result<any>> | null;
    unsubscribe: (subscriptionKey: keyof S | (keyof S)[]) => void;
    stop: () => void;
  };
};

export type NetworkContextValue<
  Q extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>,
  T extends 'builder' | 'sdk' = 'builder'
> = T extends 'builder' ? NetworkContextValueBuilder<Q, M, S> : NetworkContextValueBase<Q, M>;

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
  server: {} as Server,
  userKey: '',
  webId: '',
  environment: 'development'
} as unknown as NetworkContextValue;

const NetworkContext = createContext<NetworkContextValue>(networkContextDefaultValue);

export default NetworkContext;
