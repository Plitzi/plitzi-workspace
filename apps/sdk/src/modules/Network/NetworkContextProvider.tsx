import { cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { useEffect, useMemo, useState, useCallback, use } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { SdkQueries, SdkMutations } from '@plitzi/sdk-shared/network/graphql/sdk';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { schemaFromWire } from '@plitzi/sdk-shared/schema/wire';
import { useRenderSettings, useSdkStoreSetter } from '@plitzi/sdk-shared/store';

import { createGraphqlClient, GraphqlRequestError } from './graphqlClient';

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

const initFailureMessage = (error: string | Error): string => {
  if (!(error instanceof GraphqlRequestError)) {
    return typeof error === 'string' ? error : error.message;
  }

  if (error.statusCode === 401) {
    return 'Access not authorized';
  }

  if (error.failure === 'network') {
    return 'Service not available';
  }

  return error.message;
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
  const setSdkStore = useSdkStoreSetter();
  const offlineDataAvailable = offlineMode && !!offlineData && !!offlineData.schema;
  const client = useMemo(() => createGraphqlClient(server.serverUrl, webKey), [server.serverUrl, webKey]);
  const [loading, setLoading] = useState(!(offlineMode && !!offlineData));
  const [error, setError] = useState<ReactNode | undefined>(undefined);
  const { components } = use(ComponentContext);
  const [internalData, setInternalData] = useState<NetworkInternalContextValue>(() => {
    if (offlineDataAvailable && offlineDataType === 'json') {
      return { ...offlineData, plugins: {} };
    }

    return { plugins: {} } as NetworkInternalContextValue;
  });

  const query = useCallback(
    async <T extends keyof SdkQueriesMap>(
      queryKey: T,
      variables?: Record<string, unknown>
    ): Promise<{ success: boolean; result?: SdkQueriesMap[T]; error?: string | Error }> => {
      try {
        const result = await client.request<SdkQueriesMap[T]>(SdkQueries[queryKey], { environment, ...variables });

        return { success: true, result };
      } catch (e: unknown) {
        return { success: false, result: undefined, error: e instanceof Error ? e : String(e) };
      }
    },
    [client, environment]
  );

  const mutate = useCallback(
    async <T extends keyof SdkMutationsMap>(
      mutationKey: T,
      variables?: Record<string, unknown>,
      includeEnvironment = true
    ): Promise<{ success: boolean; result?: SdkMutationsMap[T]; error?: string | Error }> => {
      const document: string | undefined = SdkMutations[mutationKey];
      if (!document) {
        return { success: false, result: undefined, error: 'Mutation Not Found' };
      }

      try {
        const result = await client.request<SdkMutationsMap[T]>(
          document,
          includeEnvironment ? { environment, ...variables } : variables
        );

        // No unwrapping by mutation key: the SDK exposes no mutations of its own any more (writes go through the
        // server's /_action endpoint), so the raw payload is the result.
        return { success: true, result };
      } catch (e: unknown) {
        return { success: false, result: undefined, error: e instanceof Error ? e : String(e) };
      }
    },
    [client, environment]
  );

  const initQuery = async () => {
    let revisionAux: number | undefined = revision;
    if (typeof revision !== 'number' || revision === 0) {
      revisionAux = undefined;
    }

    const response = await query('Init', { environment, revision: revisionAux });
    if (response.error) {
      setLoading(false);
      setError(initFailureMessage(response.error));

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

      /**
       * The one thing this response says that the schema does not.
       *
       * A server-rendered page is handed the paywall decision in its bootstrap; a page that renders here was handed
       * nothing, and this fetch is the only moment its server got to speak. Written from the answer every time, so a
       * space that has been paid up since the last load stops saying it is over.
       */
      setSdkStore('render.overQuota', Space.render?.overQuota ?? false);

      setInternalData({
        schema: { ...EMPTY_SCHEMA.schema, ...schemaFromWire(Space.schema) },
        plugins,
        style: Space.style
      });
    }

    setLoading(false);
  };

  const initOfflineData = async () => {
    let plugins = {};
    if (offlineData?.plugins && offlineData.plugins.length > 0) {
      // @todo: this one is not compact anymore, so we need to take the props that the sdk only requires assets, settings, subPlugins
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
