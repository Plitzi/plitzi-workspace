import { CombinedGraphQLErrors, gql } from '@apollo/client/core';
import { useApolloClient } from '@apollo/client/react';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useEffect, useMemo, useState } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins';
import { behindText } from '@plitzi/sdk-shared/clients';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { BuilderQueries, BuilderMutations } from '@plitzi/sdk-shared/network/graphql/builder';
import { NetworkContext, NetworkInternalContext } from '@plitzi/sdk-shared/network/react';
import { EMPTY_SCHEMA, schemaFromWire } from '@plitzi/sdk-shared/schema';

import BuilderRefusal, { refusalOf } from './components/BuilderRefusal';
import { onPlatformVersion } from './helpers/platformVersion';
import useSubscriptionsManager from './hooks/useSubscriptionsManager';
import packageSettings from '../../../package.json';

import type { BuilderRefusal as BuilderRefusalReason } from './components/BuilderRefusal';
import type { ApolloClient, FetchPolicy } from '@apollo/client/core';
import type { Server, ComponentDefinition, Environment } from '@plitzi/sdk-shared';
import type { BuilderQueriesMap, BuilderMutationsMap, SpaceEventMap } from '@plitzi/sdk-shared/network';
import type { BuilderNetworkContextValue, NetworkInternalContextValue } from '@plitzi/sdk-shared/network/react';
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
  environment = 'main'
}: NetworkContextProviderProps) => {
  const client = useApolloClient();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BuilderRefusalReason | undefined>(undefined);
  const { registerDefinition } = use(ComponentContext);
  const [internalData, setInternalData] = useState({} as NetworkInternalContextValue);

  const query = useCallback(
    async <T extends keyof BuilderQueriesMap>(
      queryKey: T,
      variables?: Record<string, unknown>,
      fetchPolicy: FetchPolicy = 'network-only',
      silentError = false
    ): Promise<{ success: boolean; result?: BuilderQueriesMap[T]; error?: string | Error }> => {
      // Typed as always there, and not for a key that reaches here from outside the compiler — a plugin, the console.
      const document = BuilderQueries[queryKey] as string | undefined;
      if (!document) {
        addToast('Query not found', { appeareance: 'error', autoDismiss: true, placement: 'top-right' });

        throw new Error(`Query ${queryKey} not found`);
      }

      let result: ApolloClient.QueryResult<BuilderQueriesMap[T]>;
      try {
        result = await client.query<BuilderQueriesMap[T]>({
          query: gql(document),
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e) {
        /**
         * The server's own sentence when it answered with one — "the credential was refused", "no such bucket" —
         * because that is what the person can act on. Only a request that never got an answer is a network problem;
         * a GraphQL error is the server speaking, and used to be announced as the network being down.
         */
        const answered = CombinedGraphQLErrors.is(e);
        if (!silentError) {
          const message = answered ? e.errors.map(error => error.message).join(' ') : '';
          addToast(message || `Query ${queryKey} Failed`, {
            appeareance: 'error',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        if (!answered) {
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
    async <T extends keyof BuilderMutationsMap>(
      mutationKey: T,
      variables?: Record<string, unknown>,
      silentError = false,
      includeEnvironment = true,
      uploadOptions = {}
    ): Promise<{ success: boolean; result?: BuilderMutationsMap[T]; error?: string | Error }> => {
      // Typed as always there, and not for a key that reaches here from outside the compiler — a plugin, the console.
      const document = BuilderMutations[mutationKey] as string | undefined;
      if (!document) {
        addToast('Mutation not found', { appeareance: 'error', autoDismiss: true, placement: 'top-right' });

        return { success: false, result: undefined, error: 'Mutation Not Found' };
      }

      let result: ApolloClient.MutateResult<BuilderMutationsMap[T]>;
      try {
        result = await client.mutate<BuilderMutationsMap[T]>({
          mutation: gql(document),
          variables: includeEnvironment ? { environment, ...variables } : variables,
          context: {
            fetchOptions: {
              customFetch: false,
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
        return { success: true, result: (result.data as unknown as BuilderMutationsMap)[mutationKey] };
      }

      return { success: true, result: result.data };
    },
    [addToast, client, environment]
  );

  const initQuery = useCallback(async () => {
    try {
      const response = await query('Init', { environment }, 'network-only', true);
      if (response.success && response.result) {
        const { Space } = response.result;
        if (!Space) {
          setError(refusalOf('Space Not Found'));
          setLoading(false);

          return;
        }

        let plugins: Record<string, ComponentDefinition> = {};
        if (Space.plugins.length > 0) {
          plugins = await pluginParseDefinition(Space.plugins);
          registerDefinition(plugins);
        }

        setInternalData({
          schema: { ...EMPTY_SCHEMA.schema, ...schemaFromWire(Space.schema), definition: Space.definition },
          plugins,
          style: Space.style
        });
      }
    } catch (e: unknown) {
      setError(refusalOf(e));
    } finally {
      setLoading(false);
    }
  }, [environment, query, registerDefinition]);

  // Asked again from the refusal (`Try again`): the load as it ran the first time.
  const handleRetry = useCallback(() => {
    setError(undefined);
    setLoading(true);
    void initQuery();
  }, [initQuery]);

  useEffect(() => {
    void initQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = useCallback(
    (message: ReactNode, appeareance?: 'info' | 'success' | 'warning' | 'error' | 'default') => {
      addToast(message, { appeareance, autoDismiss: true, placement: 'top-right' });
    },
    [addToast]
  );

  // What the platform says of this builder: behind it, a toast once that a reload brings the current one; older than it
  // takes, the builder stops here — no request of it would be answered.
  useEffect(
    () =>
      onPlatformVersion(heard => {
        if (heard.kind === 'outdated') {
          setError(refusalOf({ statusCode: 426, message: heard.message }));

          return;
        }

        addToast(behindText('builder', packageSettings.version, heard.current), {
          appeareance: 'info',
          autoDismiss: false,
          placement: 'top-right'
        });
      }),
    [addToast]
  );

  const subscriptionManager = useSubscriptionsManager({ client, environment, onMessage: handleMessage });

  const networkValue = useMemo<BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap, SpaceEventMap>>(
    () => ({
      mutate,
      query,
      subscriptionManager,
      webKey,
      instanceId,
      server,
      userKey,
      webId,
      environment
    }),
    [mutate, query, subscriptionManager, webKey, instanceId, server, userKey, webId, environment]
  );

  if (error) {
    return <BuilderRefusal refusal={error} onRetry={handleRetry} />;
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
