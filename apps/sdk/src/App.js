// Packages
import React, { useEffect, Children, isValidElement, useMemo } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter } from 'react-router-dom';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import get from 'lodash/get';
import classNames from 'classnames';
import { HelmetProvider } from 'react-helmet-async';
import ContainerRoot from '@plitzi/plitzi-ui-components/ContainerRoot';
import { StaticRouter } from 'react-router-dom/server';

// Alias
import SdkPlugin from '@modules/Sdk/SdkPlugin';
import ComponentProvider from '@modules/Component/ComponentProvider';
import {
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
} from '@modules/Sdk';
import AppMain from '@modules/App/AppMain';

// Relatives
import { getEnvironmentServer } from './config';

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
      <ContainerRoot
        className={classNames('plitzi-sdk flex flex-col', className)}
        ssrMode={renderMode === RENDER_MODE_SSR}
      >
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
            <ComponentProvider localCustomComponents={localCustomComponents}>
              <AppMain server={finalServer} webKey={webKey} renderMode={renderMode} {...sdkProps} />
            </ComponentProvider>
          </ApolloProvider>
        </ReactRouter>
      </HelmetProvider>
    </ContainerRoot>
  );
};

App.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  // Space
  revision: PropTypes.number,
  webKey: PropTypes.string,
  environment: PropTypes.string,
  currentPageId: PropTypes.string,
  // Server
  server: PropTypes.object, // { graphqlServer, basePath, subscriptionServer, host, websocketServer }
  offlineMode: PropTypes.bool,
  offlineData: PropTypes.object, // { schema, style, plugins }
  offlineDataType: PropTypes.oneOf(['json', 'yaml']),
  // Extra
  sdkEnvironment: PropTypes.string,
  renderMode: PropTypes.oneOf([
    RENDER_MODE_IFRAME,
    RENDER_MODE_RAW,
    RENDER_MODE_SHADOW,
    RENDER_MODE_SSR,
    RENDER_MODE_WIDGET
  ]),
  sdkStylePath: PropTypes.string,
  previewMode: PropTypes.bool,
  debugMode: PropTypes.bool,
  externalStyle: PropTypes.string,
  state: PropTypes.object
};

export default App;
