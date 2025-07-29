/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable react-refresh/only-export-components */

import { ApolloError } from '@apollo/client/core';
import { withApollo } from '@apollo/client/react/hoc';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import NetworkInternalContext from './contexts/NetworkInternalContext';
import useSubscriptionsManager from './hooks/useSubscriptionsManager';
import Mutations from './Mutations';
import NetworkContext from './NetworkContext';
import Queries from './Queries';

import type { ServerEnvironment } from '../../config';
import type { NetworkInternalContextValue } from './contexts/NetworkInternalContext';
import type { ApolloClient, ApolloQueryResult, FetchPolicy, FetchResult } from '@apollo/client/core';
import type { WithApolloClient } from '@apollo/client/react/hoc';
import type {
  Server,
  CollectionRecord,
  SegmentRaw,
  CollectionRaw,
  ComponentDefinition,
  PluginRaw,
  Schema,
  SchemaRaw,
  Style
} from '@plitzi/sdk-shared';
import type { Template } from '@pmodules/Templates/TemplatesContext';
import type { DocumentNode } from 'graphql';
import type { FunctionComponent, ReactNode } from 'react';

export type NetworkContextProviderProps = {
  children: ReactNode;
  webKey?: string;
  webId: string;
  userKey?: string;
  instanceId: string;
  server: Server;
  client: ApolloClient<unknown>;
  environment?: ServerEnvironment;
};

const NetworkContextProvider = ({
  children,
  webKey = '',
  webId,
  userKey = '',
  instanceId,
  server,
  client, // hoc
  environment = 'development'
}: NetworkContextProviderProps) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const { registerDefinition } = use(ComponentContext);
  const [internalData, setInternalData] = useState<NetworkInternalContextValue>({} as NetworkInternalContextValue);

  const query = useCallback(
    async <T = unknown,>(
      queryKey: keyof typeof Queries,
      variables?: Record<string, unknown>,
      fetchPolicy: FetchPolicy = 'network-only',
      silentError = false
    ): Promise<T | ApolloError | undefined | null> => {
      if (!(Queries[queryKey] as DocumentNode | undefined)) {
        addToast('Query not found', { appeareance: 'error', autoDismiss: true, placement: 'top-right' });
      }

      let result: ApolloQueryResult<T>;
      try {
        result = await client.query<T>({
          query: Queries[queryKey],
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e) {
        if (!silentError) {
          addToast(`Query ${queryKey} Failed`, { appeareance: 'error', autoDismiss: true, placement: 'top-right' });
        }

        if (e instanceof ApolloError && e.networkError) {
          addToast('Network Not Available, Please try again', {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        return e as ApolloError;
      }

      if (result.data && result.data[queryKey] !== undefined) {
        return result.data[queryKey] as T;
      }

      return result.data;
    },
    [addToast, client, environment]
  );

  const mutate = useCallback(
    async <T = unknown,>(
      mutationKey: keyof typeof Mutations,
      variables?: Record<string, unknown>,
      silentError = false,
      includeEnvironment = true,
      uploadOptions = {}
    ): Promise<T | ApolloError | undefined | null> => {
      if (!(Mutations[mutationKey] as DocumentNode | undefined)) {
        addToast('Mutation not found', { appeareance: 'error', autoDismiss: true, placement: 'top-right' });

        return undefined;
      }

      let result: FetchResult<T>;
      // let abortHandler;
      try {
        result = await client.mutate({
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
      } catch (e) {
        if (!silentError && (e instanceof Error || e instanceof ApolloError)) {
          addToast(`Mutation ${mutationKey} Failed (${e.message})`, {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        if (e instanceof ApolloError && e.networkError) {
          addToast('Network Not Available, Please try again', {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        return e as ApolloError;
      }

      if (result.data && result.data[mutationKey] !== undefined) {
        return result.data[mutationKey] as T;
      }

      return result.data;
    },
    [addToast, client, environment]
  );

  const connectivityStatus = () => {
    console.log(window.navigator.onLine);
  };

  const initQuery = useCallback(async () => {
    const response = await query<{
      Space?: {
        plugins: PluginRaw[];
        schema: SchemaRaw;
        style: Style;
        segments?: SegmentRaw[];
      };
      Collections: { edges: CollectionRaw[] };
      Templates: { edges: Template[] };
    }>('Init', { environment, limit: 99 }, 'network-only', true);
    if (response instanceof ApolloError) {
      setLoading(false);
      if (response.networkError && 'statusCode' in response.networkError && response.networkError.statusCode === 401) {
        setError('Access not authorized');
      } else if (response.networkError) {
        setError('Service not available');
      } else {
        setError(response.message);
      }

      return;
    }

    if (response) {
      const data = cloneDeep(response);
      const { Space, Collections, Templates } = data;
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
        templates: Templates.edges.reduce<Record<string, Template>>(
          (obj, item) => ({ ...obj, [item.id as string]: item }),
          {}
        ),
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

    setLoading(false);
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

  const networkValue = useMemo(
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

export default withApollo(
  NetworkContextProvider as FunctionComponent<WithApolloClient<Omit<NetworkContextProviderProps, 'client'>>>
);
