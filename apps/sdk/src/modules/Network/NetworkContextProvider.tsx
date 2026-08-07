import { getApolloContext } from '@apollo/client/react';
import { get, cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { useEffect, useMemo, useState, useCallback, use } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { SdkQueries, SdkMutations } from '@plitzi/sdk-shared/network/graphql/sdk';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { useRenderSettings } from '@plitzi/sdk-shared/store';

import type { ApolloClient, DocumentNode, FetchPolicy } from '@apollo/client';
import type {
  OfflineDataRaw,
  Server,
  SdkQueriesMap,
  SdkMutationsMap,
  NetworkInternalContextValue,
  ComponentPluginWithHOC
} from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

export type NetworkContextProviderProps = {
  children: ReactNode;
  server: Server;
  revision?: number;
  webKey?: string;
  webId: number;
  userKey?: string;
  instanceId?: string;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
};

const NetworkContextProvider = ({
  children,
  server,
  revision,
  webKey = '',
  webId,
  userKey = '',
  instanceId,
  offlineMode = false,
  offlineData,
  offlineDataType = 'json'
}: NetworkContextProviderProps) => {
  const { environment, debugMode } = useRenderSettings();
  const offlineDataAvailable = offlineMode && !!offlineData && !!offlineData.schema;
  const client = use(getApolloContext()).client;
  const [loading, setLoading] = useState(!(offlineMode && !!offlineData));
  const [error, setError] = useState<ReactNode | undefined>(undefined);
  const { components } = use(ComponentContext);
  const [internalData, setInternalData] = useState<NetworkInternalContextValue>(() => {
    if (offlineDataAvailable && offlineDataType === 'json') {
      return { ...offlineData, plugins: {}, segments: {} };
    }

    return { plugins: {}, segments: {} } as NetworkInternalContextValue;
  });

  const query = useCallback(
    async <T extends keyof SdkQueriesMap>(
      queryKey: T,
      variables?: Record<string, unknown>,
      fetchPolicy: FetchPolicy = 'network-only'
    ): Promise<{ success: boolean; result?: SdkQueriesMap[T]; error?: string | Error }> => {
      const document = SdkQueries[queryKey];
      if (!(document as DocumentNode | undefined)) {
        setError('Query Not Found');

        throw new Error(`Query ${queryKey} not found`);
      }

      let result: ApolloClient.QueryResult<SdkQueriesMap[T]> | undefined;
      try {
        result = await client?.query<SdkQueriesMap[T]>({
          query: document,
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e: unknown) {
        return { success: false, result: undefined, error: e as Error };
      }

      if (!result) {
        setError('Network Not Available, Please try again');
      }

      return { success: true, result: result?.data };
    },
    [client, environment]
  );

  const mutate = useCallback(
    async <T extends keyof SdkMutationsMap>(
      mutationKey: T,
      variables?: Record<string, unknown>,
      includeEnvironment = true,
      uploadOptions = {}
    ): Promise<{ success: boolean; result?: SdkMutationsMap[T]; error?: string | Error }> => {
      if (!(SdkMutations[mutationKey] as DocumentNode | undefined)) {
        return { success: false, result: undefined, error: 'Mutation Not Found' };
      }

      let result: ApolloClient.MutateResult<SdkMutationsMap[T]> | undefined;
      // let abortHandler;
      try {
        result = await client?.mutate<SdkMutationsMap[T]>({
          mutation: SdkMutations[mutationKey],
          variables: includeEnvironment ? { environment, ...variables } : variables,
          context: {
            fetchOptions: {
              customFetch: false,
              // onProgress: ev => {
              //   setProgress(ev.loaded / ev.total);
              // },
              // onProgress: undefined,
              // onAbortPossible: abortHandlerInternal => {
              //   abortHandler = abortHandlerInternal;
              // },
              // onAbortPossible: undefined,
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

      // No unwrapping by mutation key: the SDK exposes no mutations of its own any more (writes go through the
      // server's /_action endpoint), so the raw payload is the result.
      return { success: true, result: result.data };
    },
    [client, environment]
  );

  const initQuery = async () => {
    let revisionAux: number | undefined = revision;
    if (typeof revision !== 'number' || revision === 0) {
      revisionAux = undefined;
    }

    const response = await query('Init', { environment, revision: revisionAux }, 'network-only');
    if (response.error) {
      setLoading(false);
      if (typeof response.error === 'string') {
        setError(response.error);
      } else if ('statusCode' in response.error && response.error.statusCode === 401) {
        setError('Access not authorized');
      } else if ('networkError' in response.error && response.error.networkError) {
        setError('Service not available');
      } else {
        setError(response.error.message);
      }

      return;
    }

    if (response.success && response.result) {
      const data = cloneDeep(response.result);
      const { Space } = data;
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
        plugins = await pluginParseDefinition(
          Space.plugins.filter(plugin => !(components.current[plugin.type] as undefined | ComponentPluginWithHOC))
        );
      }

      setInternalData({
        schema: {
          ...EMPTY_SCHEMA.schema,
          ...Space.schema,
          flat: Space.schema.flat.reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
        },
        plugins,
        style: Space.style,
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
  };

  const initOfflineData = async () => {
    let plugins = {};
    if (offlineData?.plugins && offlineData.plugins.length > 0) {
      // @todo: this one is not compact anymore, so we need to take the props that the sdk only requires assets, scope, module, settings, subPlugins
      plugins = await pluginParseDefinition(
        offlineData.plugins.filter(plugin => !(components.current[plugin.type] as undefined | ComponentPluginWithHOC))
      );
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

  const networkValue = useMemo<NetworkContextValue<SdkQueriesMap, SdkMutationsMap>>(
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
