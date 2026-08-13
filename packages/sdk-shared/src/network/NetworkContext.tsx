import { createContext } from 'react';

import type { Environment, Server } from '../types';
import type { FetchPolicy } from '@apollo/client/core';

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
  ) => Promise<{ success: boolean; result?: M[T]; error?: string | Error }>;
  query: <T extends keyof Q>(
    queryKey: T,
    variables?: Record<string, unknown>,
    fetchPolicy?: FetchPolicy,
    silentError?: boolean
  ) => Promise<{ success: boolean; result?: Q[T]; error?: string | Error }>;
  webKey: string;
  server: Server;
  userKey: string;
  webId: number;
  environment: Environment;
};

export type NetworkContextValueBuilder<
  Q extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>
> = NetworkContextValueBase<Q, M> & {
  instanceId: string;
  // Registering interest in an event, not opening a subscription: the whole space arrives on one stream, so `S` is
  // the map of event names to the payload each one carries.
  subscriptionManager: {
    /** Returns the way to undo this one registration; `all` reaches the other listeners of the event too. */
    subscribe: <T extends keyof S>(event: T, callback: (payload: S[T]) => void) => (all?: boolean) => void;
    /** Drops listeners from one event or a list of them: everyone on it, or only the callback passed. */
    unsubscribe: <T extends keyof S>(event: T | T[], all?: boolean, callback?: (payload: S[T]) => void) => void;
    stop: () => void;
  };
};

export type NetworkContextValue<
  Q extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>,
  T extends 'builder' | 'sdk' = 'sdk'
> = T extends 'builder' ? NetworkContextValueBuilder<Q, M, S> : NetworkContextValueBase<Q, M>;

export type BuilderNetworkContextValue<
  Q extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>
> = NetworkContextValue<Q, M, S, 'builder'>;

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
NetworkContext.displayName = 'NetworkContext';

export default NetworkContext;
