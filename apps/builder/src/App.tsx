import { InMemoryCache } from '@apollo/client/cache/inmemory/inMemoryCache';
import { ApolloClient, split } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { WebSocketLink } from '@apollo/client/link/ws';
import { ApolloProvider } from '@apollo/client/react/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { sdkComponents } from '@plitzi/plitzi-sdk';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Provider from '@plitzi/plitzi-ui/Provider';
import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import classNames from 'classnames';
import { Kind, OperationTypeNode } from 'graphql';
import get from 'lodash/get';
import omit from 'lodash/omit';
import { Children, isValidElement, useCallback, useEffect, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { v4 as uuidv4 } from 'uuid';

import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { getKeyDecoded, emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import AppMain from '@pmodules/App/AppMain';
import customFetch from '@pmodules/Network/helpers/customFetch';

import { getEnvironmentServer } from './config';
import packageSettings from '../package.json';

import './assets/index.scss';

import type { NormalizedCacheObject } from '@apollo/client/core';
import type { ComponentPlugin } from '@plitzi/sdk-shared';
import type { BuilderPluginProps } from '@pmodules/Builder';
import type { ReactNode } from 'react';

export type AppProps = {
  server: {
    graphqlServer: string;
    subscriptionServer: string;
  };
  webKey: string;
  includeSubscriptions: boolean;
  userKey: string;
  className: string;
  children: ReactNode;
  builderEnvironment: 'development' | 'staging' | 'production';
};

const App = (props: AppProps) => {
  const {
    children,
    server: serverProp = emptyObject,
    webKey = '',
    includeSubscriptions = true,
    userKey = '',
    className = 'min-h-screen',
    builderEnvironment = 'production'
  } = props;
  const webId = useMemo(() => getKeyDecoded(webKey, true) as string, [webKey]);
  const [instanceId, setInstanceId] = useStorage<string>(`web_${webId}_state.instanceId`, '', 'sessionStorage');

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  useEffect(() => {
    const instanceId = uuidv4();
    setInstanceId(instanceId);
  }, [webId, setInstanceId]);

  const generateClient = useCallback(
    (
      server: AppProps['server'],
      webKey: string,
      includeSubscriptions: boolean,
      instanceId: string
    ): ApolloClient<NormalizedCacheObject> & { wsLink?: WebSocketLink; subscriptionClient?: SubscriptionClient } => {
      const httpWithUploadLink = createUploadLink({ uri: server.graphqlServer, fetch: customFetch });
      const authLink = setContext((_, { headers }) => ({
        headers: {
          ...(headers as Record<string, string>),
          'plitzi-instance-id': instanceId,
          'plitzi-access-token': userKey,
          'sdk-version': packageSettings.version,
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

      const subscriptionClient = new SubscriptionClient(server.subscriptionServer, {
        reconnect: true,
        reconnectionAttempts: Infinity,
        connectionParams: { authToken: webKey, instanceId, userToken: userKey },
        connectionCallback: (error: Error[] | { message: string } | undefined) => {
          if (!error || Array.isArray(error)) {
            return;
          }

          const { message } = error;
          if (message === 'Space Not Allowed') {
            subscriptionClient.close();
          } else if (message === 'Invalid Token') {
            subscriptionClient.close();
          } else if (message === 'Missing auth token') {
            subscriptionClient.close();
          } else if (message === 'Missing instanceId') {
            subscriptionClient.close();
          } else if (message === 'Access Not Authorized') {
            subscriptionClient.close();
          } else if (message === 'Token Invalid') {
            subscriptionClient.close();
          }
        }
      });

      const wsLink = new WebSocketLink(subscriptionClient);
      const link = split(
        ({ query }) => {
          const definition = getMainDefinition(query);

          return (
            definition.kind === Kind.OPERATION_DEFINITION && definition.operation === OperationTypeNode.SUBSCRIPTION
          );
        },
        wsLink,
        authLink.concat(httpWithUploadLink)
      );

      const client: ApolloClient<NormalizedCacheObject> & {
        wsLink?: WebSocketLink;
        subscriptionClient?: SubscriptionClient;
      } = new ApolloClient({ link, cache: new InMemoryCache({ addTypename: false }) });

      client.wsLink = wsLink;
      client.subscriptionClient = subscriptionClient;

      return client;
    },
    [userKey]
  );

  const server = useMemo(() => getEnvironmentServer(builderEnvironment, serverProp), [builderEnvironment, serverProp]);
  const client = useMemo(
    () => generateClient(server, webKey, includeSubscriptions, instanceId),
    [generateClient, server, webKey, includeSubscriptions, instanceId]
  );

  const localComponents = useMemo(() => {
    const localComponents = {};
    if (!children) {
      return localComponents;
    }

    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      const { renderType, component } = child.props as BuilderPluginProps;
      if (!renderType || !(component as ComponentPlugin | undefined)) {
        return;
      }

      component.type = renderType;
      localComponents[renderType] = component;
    });

    return localComponents;
  }, [children]);

  useEffect(() => {
    return () => {
      const ws = client.subscriptionClient;
      if (ws) {
        ws.close();
      }
    };
  }, [client]);

  return (
    <Provider>
      <ContainerRoot className={classNames('plitzi-builder flex items-stretch', className)}>
        <BrowserRouter basename={get(server, 'basePath', '/')}>
          <ApolloProvider client={client}>
            <ComponentProvider
              localCustomComponents={localComponents}
              localComponents={sdkComponents as Record<string, ComponentPlugin>}
            >
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
      </ContainerRoot>
    </Provider>
  );
};

export default App;
