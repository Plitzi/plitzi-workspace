import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, ApolloLink } from '@apollo/client/core';
import { SetContextLink } from '@apollo/client/link/context';
import { RemoveTypenameFromVariablesLink } from '@apollo/client/link/remove-typename';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { ApolloProvider } from '@apollo/client/react';
import { getMainDefinition } from '@apollo/client/utilities';
// eslint-disable-next-line
// @ts-ignore
import { sdkComponents } from '@plitzi/plitzi-sdk';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Provider from '@plitzi/plitzi-ui/Provider';
import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import UploadHttpLink from 'apollo-upload-client/UploadHttpLink.mjs';
import classNames from 'classnames';
import { Kind, OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import get from 'lodash/get';
import omit from 'lodash/omit';
import { Children, isValidElement, useCallback, useEffect, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';
import AppMain from '@pmodules/App/AppMain';
import customFetch from '@pmodules/Network/helpers/customFetch';

import { getEnvironmentServer } from './config';
import packageSettings from '../package.json';

import './assets/index.scss';

import type { ComponentPlugin, Server, ServerEnvironment } from '@plitzi/sdk-shared';
import type { BuilderPluginProps } from '@pmodules/Builder';
import type { Client } from 'graphql-ws';
import type { ReactNode } from 'react';

export type AppProps = {
  className?: string;
  server?: Server;
  webKey: string;
  includeSubscriptions?: boolean;
  userKey?: string;
  children: ReactNode;
  builderEnvironment?: ServerEnvironment;
};

const App = (props: AppProps) => {
  const {
    children,
    server: serverProp,
    webKey = '',
    includeSubscriptions = true,
    userKey = '',
    className = 'min-h-screen',
    builderEnvironment = 'production'
  } = props;
  const webId = useMemo(() => getKeyDecoded(webKey, true) as string, [webKey]);
  const [instanceId, setInstanceId] = useStorage<string>(`web_${webId}_state.instanceId`, '', 'sessionStorage');
  const server = useMemo(() => getEnvironmentServer(builderEnvironment, serverProp), [builderEnvironment, serverProp]);

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
    ): (ApolloClient & { wsLink?: GraphQLWsLink; subscriptionClient?: Client }) | undefined => {
      if (!server) {
        return undefined;
      }

      const cache = new InMemoryCache();
      const noTypenameFromVariablesLink = new RemoveTypenameFromVariablesLink();
      const httpWithUploadLink = new UploadHttpLink({ uri: server.graphqlServer, fetch: customFetch });
      const authLink = new SetContextLink(prev => {
        const base = (prev.headers ?? {}) as Record<string, string>;
        const headers: Record<string, string> = {
          ...base,
          'plitzi-instance-id': instanceId,
          'plitzi-access-token': userKey,
          'sdk-version': packageSettings.version,
          'Apollo-Require-Preflight': 'true'
        };

        if (webKey) {
          headers.authorization = `Bearer ${webKey}`;
        }

        return { headers };
      });

      const mainLink = ApolloLink.from([authLink, noTypenameFromVariablesLink, httpWithUploadLink]);
      if (!includeSubscriptions || !server.subscriptionServer) {
        return new ApolloClient({ link: mainLink, cache });
      }

      const subscriptionClient = createClient({
        url: server.subscriptionServer,
        shouldRetry: () => true,
        retryAttempts: Infinity,
        connectionParams: { authToken: webKey, instanceId, userToken: userKey },
        onNonLazyError: error => {
          if (error instanceof Error) {
            const { message } = error;
            if (
              message === 'Space Not Allowed' ||
              message === 'Invalid Token' ||
              message === 'Missing auth token' ||
              message === 'Missing instanceId' ||
              message === 'Access Not Authorized' ||
              message === 'Token Invalid'
            ) {
              void subscriptionClient.dispose();
            }
          }
        }
      });

      const wsLink = new GraphQLWsLink(subscriptionClient);
      const link = ApolloLink.split(
        ({ query }) => {
          const definition = getMainDefinition(query);

          return (
            definition.kind === Kind.OPERATION_DEFINITION && definition.operation === OperationTypeNode.SUBSCRIPTION
          );
        },
        wsLink.concat(noTypenameFromVariablesLink),
        mainLink
      );

      const client: ApolloClient & { subscriptionClient?: Client } = new ApolloClient({ link, cache });
      client.subscriptionClient = subscriptionClient;

      return client;
    },
    [userKey]
  );

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

      const { renderType, component, settings, definition } = child.props as BuilderPluginProps;
      if (!renderType || !(component as ComponentPlugin | undefined)) {
        return;
      }

      component.type = renderType;
      component.pluginSettings = settings;
      if (definition) {
        component.content = definition;
      }

      localComponents[renderType] = component;
    });

    return localComponents;
  }, [children]);

  useEffect(() => {
    if (!client) {
      return;
    }

    return () => {
      const ws = client.subscriptionClient;
      if (ws) {
        void ws.dispose();
      }
    };
  }, [client]);

  return (
    <Provider>
      <ContainerRoot className={classNames('plitzi-builder flex items-stretch', className)}>
        <BrowserRouter basename={get(server, 'basePath', '/')}>
          {client && (
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
          )}
        </BrowserRouter>
      </ContainerRoot>
    </Provider>
  );
};

export default App;
