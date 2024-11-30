// Packages
import React, { useEffect, useMemo, useState } from 'react';
import isArray from 'lodash/isArray';
import { ApolloClient, split } from '@apollo/client/core';
import { InMemoryCache } from '@apollo/client/cache/inmemory/inMemoryCache';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { ApolloProvider } from '@apollo/client/react/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';
import { setContext } from '@apollo/client/link/context';
import { BrowserRouter } from 'react-router-dom';
import omit from 'lodash/omit';
import get from 'lodash/get';
import { v4 as uuidv4 } from 'uuid';
import classNames from 'classnames';
import ToastProvider from '@plitzi/plitzi-ui-components/Toast/ToastProvider';
import ContainerRoot from '@plitzi/plitzi-ui-components/ContainerRoot';
import CacheProvider from '@plitzi/plitzi-ui-components/Cache/CacheProvider';
import ThemeProvider from '@plitzi/plitzi-ui/ThemeProvider/index.cjs';

// Monorepo
import { ComponentProvider, sdkComponents } from '@plitzi/plitzi-sdk';
import { getKeyDecoded, emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import customFetch from '@pmodules/Network/helpers/customFetch';
import AppMain from '@pmodules/App/AppMain';

// Relatives
import { getEnvironmentServer } from './config';
import { loadState, saveState } from './services/session/sessionStorage';

// Builder Style
import './assets/index.scss';

/**
 * @param {{
 *   server: {
 *     graphqlServer: string;
 *     subscriptionServer: string;
 *   };
 *   webKey: string;
 *   includeSubscriptions: boolean;
 *   userKey: string;
 *   className: string;
 *   builderEnvironment: string;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const App = props => {
  const {
    server: serverProp = emptyObject,
    webKey = '',
    includeSubscriptions = true,
    userKey = '',
    className = 'min-h-screen text-gray-700',
    builderEnvironment = 'production'
  } = props;
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);
  let { children } = props;

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  const generateClient = (server, webKey, includeSubscriptions, instanceId) => {
    // this replace createHttpLink from @apollo/client/core
    const httpWithUploadLink = createUploadLink({
      uri: server.graphqlServer,
      fetch: customFetch
    });

    const authLink = setContext((_, { headers }) => ({
      headers: {
        ...headers,
        'plitzi-instance-id': instanceId,
        'plitzi-access-token': userKey,
        'sdk-version': VERSION,
        'Apollo-Require-Preflight': 'true',
        authorization: webKey ? `Bearer ${webKey}` : ''
      }
    }));

    if (!includeSubscriptions) {
      return new ApolloClient({
        link: authLink.concat(httpWithUploadLink),
        cache: new InMemoryCache({ addTypename: false })
      });
    }

    const wsLink = new WebSocketLink({
      uri: server.subscriptionServer,
      options: {
        reconnect: true,
        reconnectionAttempts: Infinity,
        connectionParams: { authToken: webKey, instanceId, userToken: userKey },
        connectionCallback: error => {
          if (!error) {
            return;
          }

          const { message } = error;
          if (message === 'Space Not Allowed') {
            wsLink.subscriptionClient.close();
          } else if (message === 'Invalid Token') {
            wsLink.subscriptionClient.close();
          } else if (message === 'Missing auth token') {
            wsLink.subscriptionClient.close();
          } else if (message === 'Missing instanceId') {
            wsLink.subscriptionClient.close();
          } else if (message === 'Access Not Authorized') {
            wsLink.subscriptionClient.close();
          } else if (message === 'Token Invalid') {
            wsLink.subscriptionClient.close();
          }
        }
      }
    });

    const link = split(
      ({ query }) => {
        const { kind, operation } = getMainDefinition(query);

        return kind === 'OperationDefinition' && operation === 'subscription';
      },
      wsLink,
      authLink.concat(httpWithUploadLink)
    );

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({ addTypename: false })
    });

    client.wsLink = wsLink;

    return client;
  };

  const instanceId = useMemo(() => {
    const sessionStorage = loadState(webId);
    if (!sessionStorage.instanceId) {
      const instanceId = uuidv4();
      saveState(webId, { instanceId });
      sessionStorage.instanceId = instanceId;
    }

    return sessionStorage.instanceId;
  }, []);

  const server = useMemo(() => getEnvironmentServer(builderEnvironment, serverProp), [serverProp]);
  const client = useMemo(
    () => generateClient(server, webKey, includeSubscriptions, instanceId),
    [server, webKey, includeSubscriptions, instanceId]
  );

  const [localComponents] = useState(() => {
    const localComponents = {};
    if (!children) {
      return localComponents;
    }

    if (!isArray(children)) {
      children = [children];
    }

    children.forEach(child => {
      const { renderType, component } = child.props;
      if (!renderType || !component) {
        return;
      }

      component.type = renderType;
      localComponents[renderType] = component;
    });

    return localComponents;
  });

  useEffect(() => {
    return () => {
      const ws = get(client, 'wsLink.subscriptionClient');
      if (ws) {
        ws.close();
      }
    };
  }, [client]);

  return (
    <ThemeProvider>
      <ContainerRoot className={classNames('plitzi-builder flex items-stretch', className)}>
        <CacheProvider cacheId="builder-state">
          <BrowserRouter basename={get(server, 'basePath', '/')}>
            <ApolloProvider client={client}>
              <ComponentProvider localCustomComponents={localComponents} localComponents={sdkComponents}>
                <ToastProvider>
                  <AppMain
                    {...omit(props, ['children', 'server', 'builderEnvironment'])}
                    server={server}
                    instanceId={instanceId}
                    webId={webId}
                  />
                </ToastProvider>
              </ComponentProvider>
            </ApolloProvider>
          </BrowserRouter>
        </CacheProvider>
      </ContainerRoot>
    </ThemeProvider>
  );
};

export default App;
