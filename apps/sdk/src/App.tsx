import { InMemoryCache } from '@apollo/client/cache';
import { ApolloClient, HttpLink } from '@apollo/client/core';
import { SetContextLink } from '@apollo/client/link/context';
import { RemoveTypenameFromVariablesLink } from '@apollo/client/link/remove-typename';
import { ApolloProvider } from '@apollo/client/react';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import Provider from '@plitzi/plitzi-ui/Provider';
import { CachePersistor, LocalStorageWrapper } from 'apollo3-cache-persist';
import classNames from 'classnames';
import get from 'lodash/get';
import { useEffect, Children, isValidElement, useMemo, useCallback, useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { StaticRouter } from 'react-router';
import { BrowserRouter } from 'react-router-dom';

import AppMain from '@modules/App/AppMain';
import sdkComponents from '@modules/Element';
import SdkPlugin from '@modules/Sdk/SdkPlugin';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';

import { getEnvironmentServer } from './config';

import type { OfflineDataRaw } from './types';
import type { RenderMode, Server, ServerEnvironment } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppProps = {
  className?: string;
  children?: ReactNode;
  cacheTimeout?: number;
  revision?: number;
  webKey: string;
  environment?: string;
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
};

const App = ({
  className = 'min-h-screen',
  children,
  cacheTimeout = 0,
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
  const [client, setClient] = useState<ApolloClient>();
  const [, setPersistor] = useState<CachePersistor<unknown>>();

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

  const finalServer = useMemo(() => getEnvironmentServer(sdkEnvironment, server), [sdkEnvironment, server]);

  const initClient = useCallback(async () => {
    const noTypenameFromVariablesLink = new RemoveTypenameFromVariablesLink();
    const httpLink = new HttpLink({ uri: finalServer.graphqlServer });
    const cache = new InMemoryCache();
    if (cacheTimeout) {
      const newPersistor = new CachePersistor({
        key: `cache-${webId}`,
        cache,
        storage: new LocalStorageWrapper(window.localStorage),
        debug: true,
        trigger: 'write'
      });

      // Invalidate Cache
      const currentTime = new Date().valueOf();
      const TTL = parseInt(localStorage.getItem(`cache-${webId}-TTL`) ?? '0');
      const TTLFuture = currentTime + cacheTimeout * 1000; // 1 minute
      if (!TTL) {
        localStorage.setItem(`cache-${webId}-TTL`, `${TTLFuture}`);
      } else if (currentTime > TTL) {
        localStorage.setItem(`cache-${webId}-TTL`, `${TTLFuture}`);
        void newPersistor.purge();
      }

      await newPersistor.restore();
      setPersistor(newPersistor);
    }

    // Init Auth Link
    // const authLink = new SetContextLink((_, { headers }) => ({
    //   headers: { ...headers, 'sdk-version': VERSION, authorization: webKey ? `Bearer ${webKey}` : '' }
    // }));

    const authLink = new SetContextLink((prevContext, operation) => {
      // const headers = prevContext.headers ?? {};

      console.log(prevContext.headers, operation.headers);

      return {
        headers: {
          ...(prevContext.headers as Record<string, string>),
          'sdk-version': VERSION,
          authorization: webKey ? `Bearer ${webKey}` : ''
        }
      };
    });

    // Init Client
    const client = new ApolloClient({ link: authLink.concat(noTypenameFromVariablesLink, httpLink), cache });
    setClient(client);
  }, [finalServer, VERSION, webKey, webId, cacheTimeout]);

  useEffect(() => {
    initClient().catch(console.error);

    return () => {};
  }, [initClient]);

  const localCustomComponents = useMemo(() => {
    const components = {};
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type !== SdkPlugin) {
        return;
      }

      const { renderType, component, assets, ...extraProps } = child.props;
      if (!renderType || !component) {
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
            {client && (
              <ApolloProvider client={client}>
                <ComponentProvider localCustomComponents={localCustomComponents}>
                  <AppMain
                    cacheTimeout={cacheTimeout}
                    server={finalServer}
                    webKey={webKey}
                    renderMode={renderMode}
                    debugMode={debugMode}
                    webId={webId}
                    {...sdkProps}
                  />
                </ComponentProvider>
              </ApolloProvider>
            )}
          </HelmetProvider>
        </ContainerRoot>
      </Provider>
    );
  }

  const ReactRouter = renderMode === 'ssr' && typeof window === 'undefined' ? StaticRouter : BrowserRouter;

  const routerParams = {};
  if (renderMode === 'ssr' && typeof window === 'undefined') {
    routerParams.location = finalServer.requestUrl;
  }

  return (
    <Provider>
      <ContainerRoot className={classNames('plitzi-sdk flex', className, { 'sdk-debug-mode': debugMode })}>
        <HelmetProvider>
          <ReactRouter basename={get(finalServer, 'basePath', '/')} {...routerParams}>
            {client && (
              <ApolloProvider client={client}>
                <ComponentProvider localCustomComponents={localCustomComponents} localComponents={sdkComponents}>
                  <AppMain
                    cacheTimeout={cacheTimeout}
                    server={finalServer}
                    webKey={webKey}
                    renderMode={renderMode}
                    debugMode={debugMode}
                    webId={webId}
                    {...sdkProps}
                  />
                </ComponentProvider>
              </ApolloProvider>
            )}
            {!client && renderMode === 'ssr' && (
              <ComponentProvider localCustomComponents={localCustomComponents} localComponents={sdkComponents}>
                <AppMain
                  cacheTimeout={cacheTimeout}
                  server={finalServer}
                  webKey={webKey}
                  renderMode={renderMode}
                  debugMode={debugMode}
                  webId={webId}
                  {...sdkProps}
                />
              </ComponentProvider>
            )}
          </ReactRouter>
        </HelmetProvider>
      </ContainerRoot>
    </Provider>
  );
};

export default App;
