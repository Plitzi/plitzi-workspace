// Packages
import React, { useEffect, Children, isValidElement, useMemo, useCallback, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createHttpLink } from '@apollo/client/link/http/createHttpLink';
import { InMemoryCache } from '@apollo/client/cache/inmemory/inMemoryCache';
import { ApolloClient } from '@apollo/client/core/ApolloClient';
import { ApolloProvider } from '@apollo/client/react/context';
import { setContext } from '@apollo/client/link/context';
import { CachePersistor, LocalStorageWrapper } from 'apollo3-cache-persist';
import get from 'lodash/get';
import classNames from 'classnames';
import { HelmetProvider } from 'react-helmet-async';
import ContainerRoot from '@plitzi/plitzi-ui-components/ContainerRoot';
import { StaticRouter } from 'react-router-dom/server';

// Monorepo
import ComponentProvider from '@plitzi/sdk-elements/ComponentProvider';
import { getKeyDecoded } from '@plitzi/sdk-shared/utils';

// Alias
import SdkPlugin from '@modules/Sdk/SdkPlugin';
import { RENDER_MODE_IFRAME, RENDER_MODE_SSR, RENDER_MODE_WIDGET } from '@modules/Sdk';
import AppMain from '@modules/App/AppMain';
import sdkComponents from '@modules/Element';

// Relatives
import { getEnvironmentServer } from './config';

/**
 * @param {{
 *   className: string;
 *   children: React.ReactNode;
 *   cacheTimeout?: number;
 *   revision: number;
 *   webKey: string;
 *   environment: string;
 *   currentPageId: string;
 *   sdkEnvironment: string;
 *   server: {
 *     graphqlServer: string;
 *     basePath: string;
 *     subscriptionServer: string;
 *     host: string;
 *     websocketServer: string;
 *   };
 *   offlineMode: boolean;
 *   offlineData: {
 *     schema: object;
 *     style: object;
 *     plugins: object;
 *     segments: object[];
 *   };
 *   offlineDataType: 'json' | 'yaml';
 *   renderMode: 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
 *   debugMode: boolean;
 *   previewMode: boolean;
 *   externalStyle: string;
 *   state: object;
 *   debugMode: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const App = props => {
  const {
    className = 'min-h-screen',
    children,
    cacheTimeout = 0,
    // Space
    webKey = '',
    // Server
    server = undefined,
    // Extra
    sdkEnvironment = 'production',
    renderMode = RENDER_MODE_IFRAME,
    debugMode: debugModeProp = false,
    ...sdkProps
  } = props;
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);
  const [debugMode, setDebugMode] = useState(false);
  const [client, setClient] = useState();
  const [, setPersistor] = useState();

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  const handleKeyDown = useCallback(e => {
    if (e.shiftKey && e.keyCode === 123) {
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
    const httpLink = createHttpLink({ uri: finalServer.graphqlServer });
    const cache = new InMemoryCache({ addTypename: false });
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
      const TTL = parseInt(localStorage.getItem(`cache-${webId}-TTL`) ?? 0);
      const TTLFuture = currentTime + cacheTimeout * 1000; // 1 minute
      if (!TTL) {
        localStorage.setItem(`cache-${webId}-TTL`, TTLFuture);
      } else if (currentTime > TTL) {
        localStorage.setItem(`cache-${webId}-TTL`, TTLFuture);
        newPersistor.purge();
      }

      await newPersistor.restore();
      setPersistor(newPersistor);
    }

    // Init Auth Link
    const authLink = setContext((_, { headers }) => ({
      headers: { ...headers, 'sdk-version': VERSION, authorization: webKey ? `Bearer ${webKey}` : '' }
    }));

    // Init Client
    const client = new ApolloClient({ link: authLink.concat(httpLink), cache });
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

      const { renderType, component, assets } = child.props;
      if (!renderType || !component) {
        return;
      }

      component.type = renderType;
      component.assets = assets;
      components[renderType] = component;
    });

    return components;
  }, [children]);

  if (renderMode === RENDER_MODE_WIDGET) {
    return (
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
    );
  }

  const ReactRouter = renderMode === RENDER_MODE_SSR && typeof window === 'undefined' ? StaticRouter : BrowserRouter;

  const routerParams = {};
  if (renderMode === RENDER_MODE_SSR && typeof window === 'undefined') {
    routerParams.location = finalServer.requestUrl;
  }

  return (
    <ContainerRoot
      className={classNames('plitzi-sdk flex', className, { 'sdk-debug-mode': debugMode })}
      ssrMode={renderMode === RENDER_MODE_SSR}
    >
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
        </ReactRouter>
      </HelmetProvider>
    </ContainerRoot>
  );
};

export default App;
