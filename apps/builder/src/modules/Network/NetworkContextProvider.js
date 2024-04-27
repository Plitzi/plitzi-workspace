// Packages
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';
import { withApollo } from '@apollo/client/react/hoc';
import cloneDeep from 'lodash/cloneDeep';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Monorepo
import { pluginParseDefinition } from '@plitzi/sdk-plugins/PluginHelper';

// Relatives
import NetworkContext from './NetworkContext';
import NetworkInternalContext from './contexts/NetworkInternalContext';
import Subscriptions from './Subscriptions';
import Mutations from './Mutations';
import Queries from './Queries';
import useSubscriptionsManager from './hooks/useSubscriptionsManager';

/**
 * @param {{
 *   children: React.ReactNode;
 *   webKey?: string;
 *   webId?: number;
 *   userKey?: string;
 *   instanceId?: string;
 *   server?: object;
 *   client?: object; // hoc
 *   environment?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const NetworkContextProvider = props => {
  const {
    children,
    webKey = '',
    webId = 0,
    userKey = '',
    instanceId,
    server,
    client,
    environment = 'development'
  } = props;
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(undefined);
  const { registerDefinition } = useContext(ComponentContext);
  const [internalData, setInternalData] = useState({});

  const query = useCallback(
    async (queryKey, variables, fetchPolicy = 'network-first', silentError = false) => {
      if (!Queries[queryKey]) {
        addToast('Query not found', {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      }

      let result;
      try {
        result = await client.query({
          query: Queries[queryKey],
          variables: { environment, ...variables },
          fetchPolicy
        });
      } catch (e) {
        if (!silentError) {
          addToast(`Query ${queryKey} Failed`, {
            appeareance: 'danger',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        return e;
      }

      if (!result) {
        addToast('Network Not Available, Please try again', {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      }

      if (result.data && result.data[queryKey] !== undefined) {
        return result.data[queryKey];
      }

      return result;
    },
    [client]
  );

  const mutate = useCallback(
    async (mutationKey, variables, silentError = false, includeEnvironment = true, uploadOptions = {}) => {
      if (!Mutations[mutationKey]) {
        addToast('Mutation not found', {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });

        return undefined;
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
        if (!silentError) {
          addToast(`Mutation ${mutationKey} Failed (${e.message})`, {
            appeareance: 'danger',
            autoDismiss: true,
            placement: 'top-right'
          });
        }

        return e;
      }

      if (!result) {
        addToast('Network Not Available, Please try again', {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      }

      if (result.data && result.data[mutationKey] !== undefined) {
        return result.data[mutationKey];
      }

      return result;
    },
    [client]
  );

  const subscribe = useCallback(
    (subscriptionKey, documentKey, variables, callback) => {
      if (!Subscriptions[subscriptionKey]) {
        addToast('Subscription not found', {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });

        return null;
      }

      const subscriptionObserver = client.subscribe({
        document: documentKey,
        query: Subscriptions[subscriptionKey],
        variables: { ...variables, environment }
      });

      subscriptionObserver.subscribe(callback, err => {
        addToast(`Subscription Error: ${err}`, {
          appeareance: 'danger',
          autoDismiss: true,
          placement: 'top-right'
        });
      });

      return subscriptionObserver;
    },
    [client]
  );

  const connectivityStatus = () => {
    console.log(window.navigator.onLine);
  };

  const initQuery = async () => {
    const response = await query('Init', { environment, limit: 99 }, 'network-first', true);
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
      const { Space, Collections, Templates } = data;
      if (!Space) {
        setError('Space Not Found');
        setLoading(false);

        return;
      }

      let plugins = {};
      if (Space.plugins.length > 0) {
        plugins = await pluginParseDefinition(Space.plugins);
        registerDefinition(plugins);
      }

      setInternalData({
        schema: { ...Space.schema, flat: Space.schema.flat.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}) },
        plugins,
        style: Space.style,
        templates: Templates.edges.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}),
        collections: Collections.edges.reduce(
          (obj, item) => ({
            ...obj,
            [item.id]: {
              ...item,
              records: item.records.edges.reduce((obj2, itemRecord) => [...obj2, itemRecord], [])
            }
          }),
          {}
        ),
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

  useEffect(() => {
    window.addEventListener('offline', connectivityStatus);
    window.addEventListener('online', connectivityStatus);

    initQuery();
    return () => {
      window.removeEventListener('offline', connectivityStatus);
      window.removeEventListener('online', connectivityStatus);
    };
  }, []);

  const handleMessage = useCallback(
    (message, appeareance) => {
      addToast(message, { appeareance, autoDismiss: true, placement: 'top-right' });
    },
    [addToast]
  );

  const subscriptionManager = useSubscriptionsManager({ client, environment, onMessage: handleMessage });

  const networkValue = useMemo(
    () => ({ mutate, query, subscribe, subscriptionManager, webKey, instanceId, server, userKey, webId }),
    [mutate, query, subscribe, subscriptionManager, webKey, instanceId, server, userKey, webId]
  );

  if (error) {
    return <div>{error}</div>;
  }

  if (loading) {
    return null;
  }

  return (
    <NetworkContext.Provider value={networkValue}>
      <NetworkInternalContext.Provider value={internalData}>{children}</NetworkInternalContext.Provider>
    </NetworkContext.Provider>
  );
};

export default withApollo(NetworkContextProvider);
