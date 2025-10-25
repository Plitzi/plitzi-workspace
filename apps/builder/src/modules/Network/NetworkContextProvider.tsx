import { CombinedGraphQLErrors } from '@apollo/client/core';
import { useApolloClient } from '@apollo/client/react';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import NetworkInternalContext from './contexts/NetworkInternalContext';
import useSubscriptionsManager from './hooks/useSubscriptionsManager';
import Mutations from './Mutations';
import Queries from './Queries';

import type { NetworkInternalContextValue } from './contexts/NetworkInternalContext';
import type { MutationsMap } from './Mutations';
import type { QueriesMap } from './Queries';
import type { SubscriptionsMap } from './Subscriptions';
import type { ApolloClient, FetchPolicy } from '@apollo/client/core';
import type {
  Server,
  CollectionRecord,
  ComponentDefinition,
  Schema,
  BuilderNetworkContextValue,
  Environment
} from '@plitzi/sdk-shared';
import type { DocumentNode } from 'graphql';
import type { ReactNode } from 'react';

export type NetworkContextProviderProps = {
  children: ReactNode;
  webKey?: string;
  webId: number;
  userKey?: string;
  instanceId: string;
  server: Server;
  environment?: Environment;
};

const NetworkContextProvider = ({
  children,
  webKey = '',
  webId,
  userKey = '',
  instanceId,
  server,
  environment = 'development'
}: NetworkContextProviderProps) => {
  const client = useApolloClient();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const { registerDefinition } = use(ComponentContext);
  const [internalData, setInternalData] = useState<NetworkInternalContextValue>({} as NetworkInternalContextValue);

  const query = useCallback(
    async <T extends keyof QueriesMap>(
      queryKey: T,
      variables?: Record<string, unknown>,
      fetchPolicy: FetchPolicy = 'network-only',
      silentError = false
    ): Promise<{ success: boolean; result?: QueriesMap[T]; error?: string | Error }> => {
      const document = Queries[queryKey];
      if (!(document as DocumentNode | undefined)) {
        addToast('Query not found', { appeareance: 'error', autoDismiss: true, placement: 'top-right' });

        throw new Error(`Query ${queryKey} not found`);
      }

      let result: ApolloClient.QueryResult<QueriesMap[T]>;
      try {
        result = await client.query<QueriesMap[T]>({
          query: document,
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e) {
        if (!silentError) {
          addToast(`Query ${queryKey} Failed`, { appeareance: 'error', autoDismiss: true, placement: 'top-right' });
        }

        if (CombinedGraphQLErrors.is(e)) {
          addToast('Network Not Available, Please try again', {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        throw e;
      }

      return { success: true, result: result.data };
    },
    [addToast, client, environment]
  );

  const mutate = useCallback(
    async <T extends keyof MutationsMap>(
      mutationKey: T,
      variables?: Record<string, unknown>,
      silentError = false,
      includeEnvironment = true,
      uploadOptions = {}
    ): Promise<{ success: boolean; result?: MutationsMap[T]; error?: string | Error }> => {
      if (!(Mutations[mutationKey] as DocumentNode | undefined)) {
        addToast('Mutation not found', { appeareance: 'error', autoDismiss: true, placement: 'top-right' });

        return { success: false, result: undefined, error: 'Mutation Not Found' };
      }

      let result: ApolloClient.MutateResult<MutationsMap[T]>;
      // let abortHandler;
      try {
        result = await client.mutate<MutationsMap[T]>({
          mutation: Mutations[mutationKey],
          variables: includeEnvironment ? { environment, ...variables } : variables,
          context: {
            fetchOptions: {
              customFetch: false,
              // onProgress: ev => {
              //   setProgress(ev.loaded / ev.total);
              // },
              // onProgress: noop,
              // onAbortPossible: abortHandlerInternal => {
              //   abortHandler = abortHandlerInternal;
              // },
              // onAbortPossible: noop,
              ...uploadOptions
            }
          }
        });
      } catch (e: unknown) {
        if (!silentError && (e instanceof Error || e instanceof Error)) {
          addToast(`Mutation ${mutationKey} Failed (${e.message})`, {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        if (e instanceof Error && 'networkError' in e) {
          addToast('Network Not Available, Please try again', {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        return { success: false, result: undefined, error: e as Error };
      }

      if (result.data && (result.data as Record<string, unknown>)[mutationKey] !== undefined) {
        return { success: true, result: (result.data as unknown as MutationsMap)[mutationKey] };
      }

      return { success: true, result: result.data };
    },
    [addToast, client, environment]
  );

  const connectivityStatus = useCallback(() => {
    console.log(window.navigator.onLine);
  }, []);

  const initQuery = useCallback(async () => {
    try {
      const response = await query('Init', { environment, limit: 99 }, 'network-only', true);
      if (response.success && response.result) {
        const data = cloneDeep(response.result);
        const { Space, Collections } = data;
        if (!Space) {
          setError('Space Not Found');
          setLoading(false);

          return;
        }

        let plugins: Record<string, ComponentDefinition> = {};
        if (Space.plugins.length > 0) {
          plugins = await pluginParseDefinition(Space.plugins);
          registerDefinition(plugins);
        }

        setInternalData({
          schema: {
            ...EMPTY_SCHEMA.schema,
            ...Space.schema,
            flat: Space.schema.flat.reduce<Schema['flat']>((obj, item) => ({ ...obj, [item.id]: item }), {})
          },
          plugins,
          style: Space.style,
          collections: Collections.edges.reduce(
            (obj, item) => ({
              ...obj,
              [item.id]: {
                ...item,
                records: item.records.edges.reduce<CollectionRecord[]>((obj2, itemRecord) => [...obj2, itemRecord], [])
              }
            }),
            {}
          ),
          segments:
            Space.segments
              ?.map(segment => ({
                ...segment,
                schema: {
                  ...get(segment, 'schema'),
                  flat: get(segment, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
                }
              }))
              .reduce((obj, segment) => ({ ...obj, [segment.identifier]: segment }), {}) ?? {}
        });
      }
    } catch (e: unknown) {
      if ((e as Error).message === 'Failed to fetch') {
        setError('Service not available');
      } else if ('statusCode' in (e as Record<string, unknown>) && (e as Record<string, unknown>).statusCode === 401) {
        setError('Access not authorized');
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [environment, query, registerDefinition]);

  useEffect(() => {
    window.addEventListener('offline', connectivityStatus);
    window.addEventListener('online', connectivityStatus);

    void initQuery();
    return () => {
      window.removeEventListener('offline', connectivityStatus);
      window.removeEventListener('online', connectivityStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = useCallback(
    (message: ReactNode, appeareance?: 'info' | 'success' | 'warning' | 'error' | 'default') => {
      addToast(message, { appeareance, autoDismiss: true, placement: 'top-right' });
    },
    [addToast]
  );

  const subscriptionManager = useSubscriptionsManager({ client, environment, onMessage: handleMessage });

  const networkValue = useMemo<BuilderNetworkContextValue<QueriesMap, MutationsMap, SubscriptionsMap>>(
    () => ({ mutate, query, subscriptionManager, webKey, instanceId, server, userKey, webId, environment }),
    [mutate, query, subscriptionManager, webKey, instanceId, server, userKey, webId, environment]
  );

  if (error) {
    return <div>{error}</div>;
  }

  if (loading) {
    return null;
  }

  return (
    <NetworkContext value={networkValue}>
      <NetworkInternalContext value={internalData}>{children}</NetworkInternalContext>
    </NetworkContext>
  );
};

export default NetworkContextProvider;
