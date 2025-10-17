import { useApolloClient } from '@apollo/client/react';
import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import noop from 'lodash/noop';
import { useEffect, useMemo, useState, useCallback } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import NetworkInternalContext from './contexts/NetworkInternalContext';
import Mutations from './Mutations';
import Queries from './Queries';

import type { MutationsMap } from './Mutations';
import type { QueriesMap } from './Queries';
import type { OfflineData, OfflineDataRaw } from '../../types';
import type { ApolloClient, DocumentNode, FetchPolicy } from '@apollo/client';
import type { Server } from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

export type NetworkContextProviderProps = {
  children: ReactNode;
  cacheTimeout?: number;
  server: Server;
  revision: number;
  webKey?: string;
  webId?: string;
  userKey?: string;
  instanceId: string;
  environment?: 'development' | 'staging' | 'production';
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'compact';
  debugMode?: boolean;
  renderMode?: 'ssr' | 'iframe' | 'widget' | 'raw' | 'shadow';
};

const NetworkContextProvider = ({
  children,
  cacheTimeout = 0,
  server,
  revision,
  webKey = '',
  webId = '',
  userKey = '',
  instanceId,
  environment = 'development',
  offlineMode = false,
  offlineData,
  offlineDataType = 'json',
  debugMode = false,
  renderMode = 'iframe'
}: NetworkContextProviderProps) => {
  const offlineDataAvailable = offlineMode && !!offlineData && !!offlineData.schema;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const client = renderMode === 'ssr' && offlineDataAvailable ? undefined : useApolloClient();
  const [loading, setLoading] = useState(!(offlineMode && !!offlineData));
  const [error, setError] = useState<ReactNode | undefined>(undefined);
  const [internalData, setInternalData] = useState<OfflineData>(() => {
    if (offlineDataAvailable && offlineDataType === 'json') {
      return { ...offlineData, plugins: {} };
    }

    return {} as OfflineData;
  });

  const query = useCallback(
    async <T extends keyof QueriesMap>(
      queryKey: T,
      variables?: Record<string, unknown>,
      fetchPolicy: FetchPolicy = 'network-only'
    ): Promise<{ success: boolean; result?: QueriesMap[T]; error?: string | Error }> => {
      const document = Queries[queryKey];
      if (!(document as DocumentNode | undefined)) {
        setError('Query Not Found');

        throw new Error(`Query ${queryKey} not found`);
      }

      let result: ApolloClient.QueryResult<QueriesMap[T]> | undefined;
      try {
        result = await client?.query<QueriesMap[T]>({
          query: document,
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e: unknown) {
        return { success: false, result: undefined, error: (e as Error).message };
      }

      if (!result) {
        setError('Network Not Available, Please try again');
      }

      return { success: true, result: result?.data };
    },
    [client, environment]
  );

  const mutate = useCallback(
    async <T extends keyof MutationsMap>(
      mutationKey: T,
      variables?: Record<string, unknown>,
      includeEnvironment = true,
      uploadOptions = {}
    ): Promise<{ success: boolean; result?: MutationsMap[T]; error?: string | Error }> => {
      if (!(Mutations[mutationKey] as DocumentNode | undefined)) {
        return { success: false, result: undefined, error: 'Mutation Not Found' };
      }

      let result: ApolloClient.MutateResult<MutationsMap[T]> | undefined;
      // let abortHandler;
      try {
        result = await client?.mutate({
          mutation: Mutations[mutationKey],
          variables: includeEnvironment ? { environment, ...variables } : variables,
          context: {
            fetchOptions: {
              customFetch: false,
              // onProgress: ev => {
              //   setProgress(ev.loaded / ev.total);
              // },
              onProgress: noop,
              // onAbortPossible: abortHandlerInternal => {
              //   abortHandler = abortHandlerInternal;
              // },
              onAbortPossible: noop,
              ...uploadOptions
            }
          }
        });
      } catch (e: unknown) {
        return { success: false, result: undefined, error: e as Error };
      }

      if (!result) {
        return { success: false, result: undefined, error: 'Network Not Available, Please try again' };
      }

      if (result.data && (result.data as Record<string, unknown>)[mutationKey] !== undefined) {
        return { success: true, result: (result.data as unknown as MutationsMap)[mutationKey] };
      }

      return { success: true, result: result.data };
    },
    [client, environment]
  );

  const initQuery = async () => {
    let revisionAux: number | undefined = revision;
    if (typeof revision !== 'number' || revision === 0) {
      revisionAux = undefined;
    }

    const response = await query(
      'Init',
      { environment, revision: revisionAux, limit: 99 },
      cacheTimeout === 0 ? 'network-only' : 'cache-first'
    );
    if (response.error instanceof Error) {
      setLoading(false);
      setError(typeof response.error === 'string' ? response.error : response.error.message);
      // if (response.error.statusCode === 401) {
      //   setError('Access not authorized');
      // } else if (response.networkError) {
      //   setError('Service not available');
      // } else {
      //   setError(response.message);
      // }

      return;
    }

    if (response.success && response.result) {
      const data = cloneDeep(response.result);
      const { Space, Collections } = data;
      if (!Space) {
        setError(
          <span>
            Space not found, publish to <b>{environment}</b> environment
          </span>
        );
        setLoading(false);

        return;
      }

      let plugins = {};
      if (Space.plugins.length > 0) {
        plugins = await pluginParseDefinition(Space.plugins);
      }

      setInternalData({
        schema: {
          ...EMPTY_SCHEMA.schema,
          ...Space.schema,
          flat: Space.schema.flat.reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
        },
        plugins,
        style: Space.style,
        collections: Collections.edges.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}),
        segments: Space.segments
          ?.map(segment => ({
            ...segment,
            schema: {
              ...get(segment, 'schema'),
              flat: get(segment, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
            }
          }))
          .reduce((obj, segment) => ({ ...obj, [segment.identifier]: segment }), {})
      });
    }

    setLoading(false);
  };

  const initOfflineData = async () => {
    let plugins = {};
    if (offlineData?.plugins && offlineData.plugins.length > 0) {
      // @todo: this one is not compact anymore, so we need to take the props that the sdk only requires assets, scope, module, settings, subPlugins
      plugins = await pluginParseDefinition(offlineData.plugins);
    }

    setInternalData(state => ({ ...state, plugins }));
    setLoading(false);
  };

  useEffect(() => {
    if (!offlineMode || !offlineData) {
      setLoading(state => {
        if (!state) {
          return true;
        }

        return state;
      });
      void initQuery();
    } else if (offlineDataAvailable) {
      void initOfflineData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineDataAvailable, offlineMode && offlineDataType, webKey, environment, debugMode]);

  const networkValue = useMemo<NetworkContextValue<QueriesMap, MutationsMap>>(
    () => ({ query, mutate, webKey, webId, server, environment, instanceId, userKey }),
    [query, mutate, webKey, webId, server, environment, instanceId, userKey]
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
