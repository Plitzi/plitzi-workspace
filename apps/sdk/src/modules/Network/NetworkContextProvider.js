// Packages
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { withApollo } from '@apollo/client/react/hoc/withApollo';
import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Monorepo
import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';
import { EMPTY_SCHEMA } from '@plitzi/sdk-schema/helpers/FlatMap';

// Relatives
import NetworkContext from './NetworkContext';
import Queries from './Queries';
import Mutations from './Mutations';
import NetworkInternalContext from './contexts/NetworkInternalContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   cacheTimeout?: number;
 *   server: string;
 *   revision: number;
 *   webKey: string;
 *   webId: number;
 *   environment: 'development' | 'staging' | 'production';
 *   offlineMode: boolean;
 *   offlineData: object;
 *   offlineDataType: string;
 *   client: any;
 *   debugMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const NetworkContextProvider = props => {
  const {
    children,
    cacheTimeout = 0,
    server,
    revision,
    webKey = '',
    webId = 0,
    environment = 'development',
    offlineMode = false,
    offlineData,
    offlineDataType = 'json',
    debugMode = false,
    // hocs
    client
  } = props;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [internalData, setInternalData] = useState({});

  const query = useCallback(
    async (queryKey, variables, fetchPolicy = 'network-first') => {
      if (!Queries[queryKey]) {
        setError('Query Not Found');

        return null;
      }

      let result;
      try {
        result = await client.query({
          query: Queries[queryKey],
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e) {
        return e;
      }

      if (!result) {
        setError('Network Not Available, Please try again');
      }

      if (result.data && result.data[queryKey] !== undefined) {
        return result.data[queryKey];
      }

      return result;
    },
    [client]
  );

  const mutate = useCallback(
    async (mutationKey, variables, includeEnvironment = true, uploadOptions = {}) => {
      if (!Mutations[mutationKey]) {
        return { success: false, result: undefined, error: 'Mutation Not Found' };
      }

      let result;
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
              onProgress: noop,
              // onAbortPossible: abortHandlerInternal => {
              //   abortHandler = abortHandlerInternal;
              // },
              onAbortPossible: noop,
              ...uploadOptions
            }
          }
        });
      } catch (e) {
        return { success: false, result: undefined, error: e.message };
      }

      if (!result) {
        return { success: false, result: undefined, error: 'Network Not Available, Please try again' };
      }

      if (result.data && result.data[mutationKey] !== undefined) {
        return { success: true, result: result.data[mutationKey] };
      }

      return { success: true, result };
    },
    [client]
  );

  const initQuery = async () => {
    let revisionAux = revision;
    if (typeof revision !== 'number' || revision === 0) {
      revisionAux = undefined;
    }

    const response = await query(
      'Init',
      { environment, revision: revisionAux, limit: 99 },
      cacheTimeout === 0 ? 'network-first' : 'cache-first'
    );
    if (response instanceof Error) {
      setLoading(false);
      if (response.networkError && response.networkError.statusCode === 401) {
        setError('Access not authorized');
      } else if (response.networkError) {
        setError('Service not available');
      } else {
        setError(response.message);
      }

      return;
    }

    if (response.data) {
      const data = cloneDeep(response.data);
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
      if (Space.plugins && Space.plugins.length > 0) {
        plugins = await pluginParseDefinition(Space.plugins, !debugMode);
      }

      setInternalData({
        schema: {
          ...EMPTY_SCHEMA.schema,
          ...Space.schema,
          flat: Space.schema.flat?.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}) ?? {}
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
    let data = {};
    if (offlineMode && offlineData && offlineData.schema && offlineDataType === 'json') {
      data = offlineData;
    } else if (offlineMode && offlineData && offlineDataType === 'yaml') {
      data = {}; // @todo: helper to transform yaml to json
    }

    let plugins = {};
    if (data.plugins && data.plugins.length > 0) {
      plugins = await pluginParseDefinition(data.plugins, !debugMode);
    }

    setInternalData({ ...data, plugins });
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
      initQuery();
    } else if (offlineMode && offlineData) {
      initOfflineData();
    }
  }, [offlineMode && offlineData, offlineMode && offlineDataType, webKey, environment, debugMode]);

  const networkValue = useMemo(
    () => ({ query, mutate, webKey, webId, server, environment }),
    [query, mutate, webKey, webId, server, environment]
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

export default withApollo(NetworkContextProvider);
