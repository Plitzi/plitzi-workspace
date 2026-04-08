import { ApolloProvider } from '@apollo/client/react';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { buttonTheme } from '@plitzi/plitzi-ui/Button';
import { containerCollapsableTheme } from '@plitzi/plitzi-ui/ContainerCollapsable';
import { containerResizableTheme } from '@plitzi/plitzi-ui/ContainerResizable';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import { containerTabsTheme } from '@plitzi/plitzi-ui/ContainerTabs';
import { contentEditableTheme } from '@plitzi/plitzi-ui/ContentEditable';
import { headingTheme } from '@plitzi/plitzi-ui/Heading';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { inputTheme } from '@plitzi/plitzi-ui/Input';
import { markdownTheme } from '@plitzi/plitzi-ui/Markdown';
import Provider from '@plitzi/plitzi-ui/Provider';
import { textTheme } from '@plitzi/plitzi-ui/Text';
import clsx from 'clsx';
import { useEffect, Children, isValidElement, useMemo, useCallback, Fragment } from 'react';
import * as React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { StaticRouter } from 'react-router';
import { BrowserRouter } from 'react-router-dom';

import { initClient } from '@modules/App/AppHelper';
import AppMain from '@modules/App/AppMain';
import sdkComponents from '@modules/Element';
import SdkPlugin from '@modules/Sdk/SdkPlugin';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { createStoreDevToolsLogger, generateFacade, StoreProvider } from '@plitzi/sdk-shared';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';

import { getEnvironmentServer } from './config';
import * as PlitziSDK from './index';

import type { ApolloClient } from '@apollo/client/core';
import type { SdkPluginProps } from '@modules/Sdk/SdkPlugin';
import type {
  ComponentPlugin,
  ComponentPluginFC,
  Environment,
  EventBridgeContextValue,
  OfflineDataRaw,
  RenderMode,
  Server,
  ServerEnvironment,
  StateManagerContextValue
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppProps = {
  className?: string;
  children?: ReactNode;
  revision?: number;
  webKey?: string;
  environment?: Environment;
  currentPageId?: string;
  sdkEnvironment?: ServerEnvironment;
  server?: Partial<Server>;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
  renderMode?: RenderMode;
  debugMode?: boolean;
  isHydrating?: boolean;
  previewMode?: boolean;
  externalStyle?: string;
  state?: Record<string, unknown>;
  onInitStateManager?: (instance: StateManagerContextValue) => void;
  onInitEventBridge?: (instance: EventBridgeContextValue) => void;
};

const components = {
  Button: buttonTheme,
  ContentEditable: contentEditableTheme,
  Input: inputTheme,
  Heading: headingTheme,
  ContainerResizable: containerResizableTheme,
  ContainerCollapsable: containerCollapsableTheme,
  Text: textTheme,
  Markdown: markdownTheme,
  ContainerTabs: containerTabsTheme
};

const App = ({
  className = 'min-h-screen',
  children,
  // Space
  webKey = '',
  // Server
  server = undefined,
  // Extra
  sdkEnvironment = 'production',
  renderMode = 'iframe',
  debugMode: debugModeProp = false,
  ...sdkProps
}: AppProps) => {
  useMemo(
    () =>
      generateFacade({
        react: React,
        'react/jsx-runtime': JSXRuntime,
        'react-dom': ReactDOM,
        'react-dom/client': ReactDOMClient,
        '@plitzi/plitzi-sdk': PlitziSDK
      }),
    []
  );
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);
  const [debugMode, setDebugMode] = useStorage(`web_${webId}_state.debugMode`, false, 'localStorage', debugModeProp);
  const finalServer = useMemo(() => getEnvironmentServer(sdkEnvironment, server), [sdkEnvironment, server]);
  const client = useMemo<ApolloClient>(() => initClient(finalServer, webKey), [finalServer, webKey]);

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

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

  const localCustomComponents = useMemo(() => {
    const components: Record<string, ComponentPlugin> = {};
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type !== SdkPlugin) {
        return;
      }

      const { renderType, component: componentFC, assets = [], ...extraProps } = child.props as SdkPluginProps;
      if (!renderType || !(componentFC as ComponentPluginFC | undefined)) {
        return;
      }

      const component = componentFC as ComponentPlugin;
      component.type = renderType;
      component.assets = assets;
      component.extraProps = extraProps;
      components[renderType] = component;
    });

    return components;
  }, [children]);

  const routerParams = {} as { location: Location | string };
  if (typeof window === 'undefined') {
    routerParams.location = finalServer.requestUrl ?? '';
  }

  const ReactRouter = renderMode === 'widget' ? Fragment : typeof window === 'undefined' ? StaticRouter : BrowserRouter;
  const reactRouterProps =
    renderMode === 'widget'
      ? {}
      : {
          basename: get(finalServer, 'basePath', '/'),
          location: typeof window === 'undefined' ? (finalServer.requestUrl ?? '') : undefined
        };

  return (
    <StoreProvider logger={createStoreDevToolsLogger('sdk')}>
      <Provider components={components}>
        <ContainerRoot className={clsx('plitzi-sdk flex', className, { 'sdk-debug-mode': debugMode })}>
          <HelmetProvider>
            <ReactRouter {...(reactRouterProps as { location: string })}>
              <ApolloProvider client={client}>
                <ComponentProvider localCustomComponents={localCustomComponents} localComponents={sdkComponents}>
                  <AppMain
                    server={finalServer}
                    webKey={webKey}
                    renderMode={renderMode}
                    debugMode={debugMode}
                    webId={webId}
                    sdkEnvironment={sdkEnvironment}
                    {...sdkProps}
                  />
                </ComponentProvider>
              </ApolloProvider>
            </ReactRouter>
          </HelmetProvider>
        </ContainerRoot>
      </Provider>
    </StoreProvider>
  );
};

export default App;
