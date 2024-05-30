// Packages
import React, { useEffect, Children, isValidElement, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createHttpLink } from '@apollo/client/link/http/createHttpLink';
import { InMemoryCache } from '@apollo/client/cache/inmemory/inMemoryCache';
import { ApolloClient } from '@apollo/client/core/ApolloClient';
import { ApolloProvider } from '@apollo/client/react/context';
import { setContext } from '@apollo/client/link/context';
import get from 'lodash/get';
import classNames from 'classnames';
import { HelmetProvider } from 'react-helmet-async';
import ContainerRoot from '@plitzi/plitzi-ui-components/ContainerRoot';
import { StaticRouter } from 'react-router-dom/server';

// Monorepo
import ComponentProvider from '@plitzi/sdk-elements/ComponentProvider';

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
 * }} props
 * @returns {React.ReactElement}
 */
const App = props => {
  const {
    className = 'min-h-screen',
    children,
    // Space
    webKey = '',
    // Server
    server = undefined,
    // Extra
    sdkEnvironment = 'production',
    renderMode = RENDER_MODE_IFRAME,
    ...sdkProps
  } = props;

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  const finalServer = useMemo(() => getEnvironmentServer(sdkEnvironment, server), [sdkEnvironment, server]);

  const client = useMemo(() => {
    const httpLink = createHttpLink({
      uri: finalServer.graphqlServer
    });

    const authLink = setContext((_, { headers }) => ({
      headers: { ...headers, 'sdk-version': VERSION, authorization: webKey ? `Bearer ${webKey}` : '' }
    }));

    const client = new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache({ addTypename: false })
    });

    return client;
  }, [finalServer, VERSION, webKey]);

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
      <ContainerRoot className={classNames('plitzi-sdk flex flex-col', className)}>
        <HelmetProvider>
          <ApolloProvider client={client}>
            <ComponentProvider localCustomComponents={localCustomComponents}>
              <AppMain server={finalServer} webKey={webKey} renderMode={renderMode} {...sdkProps} />
            </ComponentProvider>
          </ApolloProvider>
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
      className={classNames('plitzi-sdk flex flex-col', className)}
      ssrMode={renderMode === RENDER_MODE_SSR}
    >
      <HelmetProvider>
        <ReactRouter basename={get(finalServer, 'basePath', '/')} {...routerParams}>
          <ApolloProvider client={client}>
            <ComponentProvider localCustomComponents={localCustomComponents} localComponents={sdkComponents}>
              <AppMain server={finalServer} webKey={webKey} renderMode={renderMode} {...sdkProps} />
            </ComponentProvider>
          </ApolloProvider>
        </ReactRouter>
      </HelmetProvider>
    </ContainerRoot>
  );
};

export default App;
