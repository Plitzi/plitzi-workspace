import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, ApolloLink } from '@apollo/client/core';
import { SetContextLink } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { ApolloProvider } from '@apollo/client/react';
import { getMainDefinition } from '@apollo/client/utilities';
import { sdkComponents } from '@plitzi/plitzi-sdk';
import {
  accordionTheme,
  alertTheme,
  badgeTheme,
  breadcrumbTheme,
  buttonTheme,
  cardTheme,
  checkboxTheme,
  codeMirrorTheme,
  colorPickerTheme,
  containerCollapsableTheme,
  containerDraggableTheme,
  containerFloatingTheme,
  containerFrameTheme,
  containerResizableTheme,
  containerTabsTheme,
  contentEditableTheme,
  errorMessageTheme,
  fileUploadTheme,
  flexTheme,
  formTheme,
  headingTheme,
  iconGroupTheme,
  iconTheme,
  inputTheme,
  kvInputTheme,
  labelTheme,
  markdownTheme,
  menuListTheme,
  metricInputTheme,
  modalTheme,
  popupTheme,
  queriBuilderTheme,
  select2Theme,
  selectTheme,
  sidebarTheme,
  switchTheme,
  textAreaTheme,
  textTheme,
  treeTheme
} from '@plitzi/plitzi-ui/components';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import { omit } from '@plitzi/plitzi-ui/helpers/lodash';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Provider from '@plitzi/plitzi-ui/Provider';
import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import UploadHttpLink from 'apollo-upload-client/UploadHttpLink.mjs';
import clsx from 'clsx';
import { Kind, OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import { Children, isValidElement, useCallback, useEffect, useMemo } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { historyMiddleware as historyMw, loggerMiddleware as loggerMw } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { createStoreDevToolsLogger, ThemeProvider, type BuilderState } from '@plitzi/sdk-shared';
import { createStripTypenameLink } from '@plitzi/sdk-shared/helpers/stripTypename';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';
import { runtimeStatePersist } from '@plitzi/sdk-shared/state/runtimeStatePersist';
import AppMain from '@pmodules/App/AppMain';
import customFetch from '@pmodules/Network/helpers/customFetch';

import { getEnvironmentServer } from './config';
import packageSettings from '../package.json';

import './assets/index.scss';

import type { ComponentPlugin, ComponentPluginFC, Server } from '@plitzi/sdk-shared';
import type { BuilderPluginProps } from '@pmodules/Builder/BuilderPlugin';
import type { Client } from 'graphql-ws';
import type { ReactNode } from 'react';

export type AppProps = {
  children?: ReactNode;
  className?: string;
  server?: Partial<Server>;
  webKey: string;
  includeSubscriptions?: boolean;
  userKey?: string;
  debugMode?: boolean;
};

const components = {
  Button: buttonTheme,
  FileUpload: fileUploadTheme,
  ContentEditable: contentEditableTheme,
  Card: cardTheme,
  Form: formTheme,
  Input: inputTheme,
  Switch: switchTheme,
  Checkbox: checkboxTheme,
  Select: selectTheme,
  Select2: select2Theme,
  Heading: headingTheme,
  Flex: flexTheme,
  ContainerResizable: containerResizableTheme,
  ContainerCollapsable: containerCollapsableTheme,
  Icon: iconTheme,
  IconGroup: iconGroupTheme,
  Popup: popupTheme,
  Sidebar: sidebarTheme,
  Tree: treeTheme,
  Accordion: accordionTheme,
  QueryBuilder: queriBuilderTheme,
  Alert: alertTheme,
  Modal: modalTheme,
  Text: textTheme,
  Label: labelTheme,
  TextArea: textAreaTheme,
  ContainerFrame: containerFrameTheme,
  KVInput: kvInputTheme,
  Markdown: markdownTheme,
  MenuList: menuListTheme,
  ContainerDraggable: containerDraggableTheme,
  Breadcrumb: breadcrumbTheme,
  CodeMirror: codeMirrorTheme,
  ErrorMessage: errorMessageTheme,
  ColorPicker: colorPickerTheme,
  MetricInput: metricInputTheme,
  ContainerTabs: containerTabsTheme,
  ContainerFloating: containerFloatingTheme,
  Badge: badgeTheme
};

const App = (props: AppProps) => {
  const {
    children,
    server: serverProp,
    webKey = '',
    includeSubscriptions = true,
    userKey = '',
    className = 'min-h-screen',
    debugMode: debugModeProp = false
  } = props;
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);
  const [instanceId, setInstanceId] = useStorage(`web_${webId}_state.instanceId`, '', 'sessionStorage');
  const [debugMode, setDebugMode] = useStorage('builder-state.debugMode', false, 'localStorage', debugModeProp);
  const server = useMemo(() => getEnvironmentServer(serverProp), [serverProp]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'F12') {
        setDebugMode(state => !state);
      }
    },
    [setDebugMode]
  );

  useEffect(() => {
    if (!debugModeProp) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, debugModeProp]);

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  let hasBrowserRouter = false as boolean;
  try {
    // This logic is used to identify if the builder is inside another app with react-router, for example in the SDK
    useLocation();
    hasBrowserRouter = true;
  } catch {
    hasBrowserRouter = false;
  }

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

      const mainLink = ApolloLink.from([createStripTypenameLink(), authLink, httpWithUploadLink]);
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
        ApolloLink.from([createStripTypenameLink(), wsLink]),
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
    const localComponents: Record<string, ComponentPlugin> = {};
    if (!children) {
      return localComponents;
    }

    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      const {
        renderType,
        component: componentFC,
        settings,
        definition,
        ...extraProps
      } = child.props as BuilderPluginProps;
      if (!renderType || !(componentFC as ComponentPluginFC | undefined)) {
        return;
      }

      const component = componentFC as ComponentPlugin;
      component.type = renderType;
      component.pluginSettings = settings;
      component.extraProps = extraProps;
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

  const childrenParsed = useMemo(
    () =>
      client && (
        <ApolloProvider client={client}>
          <ComponentProvider localCustomComponents={localComponents} localComponents={sdkComponents}>
            <ToastProvider>
              <AppMain
                {...omit(props, ['children', 'server'])}
                debugMode={debugMode}
                server={server}
                instanceId={instanceId}
                webId={webId}
              />
            </ToastProvider>
          </ComponentProvider>
        </ApolloProvider>
      ),
    [client, debugMode, instanceId, localComponents, props, server, webId]
  );

  const storeValue = useMemo(() => ({ styleSelector: 'base' }), []);

  return (
    <StoreProvider<BuilderState>
      value={storeValue}
      middlewares={[
        loggerMw(createStoreDevToolsLogger<BuilderState>('builder')),
        runtimeStatePersist<BuilderState>(webId),
        ...(debugMode ? [historyMw<BuilderState>({ shouldRecord: p => !p?.startsWith('runtime.elements') })] : [])
      ]}
    >
      <ThemeProvider storageKey="builder-state.theme">
        <Provider components={components}>
          <ContainerRoot className={clsx('plitzi-builder flex items-stretch', className)}>
            {!hasBrowserRouter && <BrowserRouter basename={server.basePath ?? ''}>{childrenParsed}</BrowserRouter>}
            {hasBrowserRouter && childrenParsed}
          </ContainerRoot>
        </Provider>
      </ThemeProvider>
    </StoreProvider>
  );
};

export default App;
