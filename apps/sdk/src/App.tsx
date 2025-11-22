import { ApolloProvider } from '@apollo/client/react';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import Provider from '@plitzi/plitzi-ui/Provider';
import classNames from 'classnames';
import get from 'lodash-es/get';
import { useEffect, Children, isValidElement, useMemo, useCallback, useState } from 'react';
import { StaticRouter } from 'react-router';
import { BrowserRouter } from 'react-router-dom';

import { initClient } from '@modules/App/AppHelper';
import AppMain from '@modules/App/AppMain';
import sdkComponents from '@modules/Element';
import SdkPlugin from '@modules/Sdk/SdkPlugin';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';

import { getEnvironmentServer } from './config';

import type { OfflineDataRaw } from './types';
import type { ApolloClient } from '@apollo/client/core';
import type { SdkPluginProps } from '@modules/Sdk/SdkPlugin';
import type {
  ComponentPlugin,
  Environment,
  EventBridgeContextValue,
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
  server?: Server;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
  renderMode?: RenderMode;
  debugMode?: boolean;
  previewMode?: boolean;
  externalStyle?: string;
  state?: Record<string, unknown>;
  onInitStateManager?: (instance: StateManagerContextValue) => void;
  onInitEventBridge?: (instance: EventBridgeContextValue) => void;
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
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);
  const [debugMode, setDebugMode] = useState(false);
  const finalServer = useMemo(() => getEnvironmentServer(sdkEnvironment, server), [sdkEnvironment, server]);
  const client = useMemo<ApolloClient>(() => initClient(finalServer, webKey), [finalServer, webKey]);

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.shiftKey && e.key === 'F12') {
      setDebugMode(state => !state);
    }
  }, []);

  useEffect(() => {
    if (!debugModeProp) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, debugModeProp]);

  const localCustomComponents = useMemo(() => {
    const components = {};
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type !== SdkPlugin) {
        return;
      }

      const { renderType, component, assets = [], ...extraProps } = child.props as SdkPluginProps;
      if (!renderType || !(component as ComponentPlugin | undefined)) {
        return;
      }

      component.type = renderType;
      component.assets = assets;
      component.extraProps = extraProps;
      components[renderType] = component;
    });

    return components;
  }, [children]);

  if (renderMode === 'widget') {
    return (
      <Provider>
        <ContainerRoot className={classNames('plitzi-sdk flex', className, { 'sdk-debug-mode': debugMode })}>
          <HelmetProvider>
            <ApolloProvider client={client}>
              <ComponentProvider localCustomComponents={localCustomComponents}>
                <AppMain
                  server={finalServer}
                  webKey={webKey}
                  renderMode={renderMode}
                  debugMode={debugMode}
                  webId={webId}
                  {...sdkProps}
                />
              </ComponentProvider>
            </ApolloProvider>
          </HelmetProvider>
        </ContainerRoot>
      </Provider>
    );
  }

  const ReactRouter = renderMode === 'ssr' || typeof window === 'undefined' ? StaticRouter : BrowserRouter;

  const routerParams = {} as { location: Location | string };
  if (renderMode === 'ssr' && typeof window === 'undefined') {
    routerParams.location = finalServer.requestUrl ?? '';
  }

  return (
    <Provider>
      <ContainerRoot className={classNames('plitzi-sdk flex', className, { 'sdk-debug-mode': debugMode })}>
        <HelmetProvider>
          <ReactRouter basename={get(finalServer, 'basePath', '/')} {...routerParams}>
            <ApolloProvider client={client}>
              <ComponentProvider localCustomComponents={localCustomComponents} localComponents={sdkComponents}>
                <AppMain
                  server={finalServer}
                  webKey={webKey}
                  renderMode={renderMode}
                  debugMode={debugMode}
                  webId={webId}
                  {...sdkProps}
                />
              </ComponentProvider>
            </ApolloProvider>
          </ReactRouter>
        </HelmetProvider>
      </ContainerRoot>
    </Provider>
  );
};

export default App;
