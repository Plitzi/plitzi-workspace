// Packages
import React, { useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// Monorepo
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import ComponentProvider from '@plitzi/sdk-elements/ComponentProvider';
import RootElement from '@plitzi/sdk-elements/RootElement';
import withElement from '@plitzi/sdk-elements/withElement';
import JsxManager from '@plitzi/sdk-elements/JsxManager';
import PluginRemote from '@plitzi/sdk-elements/PluginRemote';
import PluginManager from '@plitzi/sdk-elements/PluginManager';
import ReplicaProvider from '@plitzi/sdk-elements/ReplicaProvider';
import usePlitziServiceContext, { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

// Alias
import Sdk, {
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
} from '@modules/Sdk';
import sdkComponents from '@modules/Element';

// Relatives
import { disableReactDevTools } from './helpers/security';
import App from './App';

// SDK Style
import './assets/index.scss';

let stateManager;
let eventBridge;

export function render(widgetContainer, params = {}, plugins = {}, debugMode = false) {
  const Widget = () => {
    const pluginKeys = Object.keys(plugins);
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }

    const handleInitStateManager = useCallback(instance => {
      stateManager = instance;
    }, []);

    const handleInitEventBridge = useCallback(instance => {
      eventBridge = instance;
    }, []);

    return (
      <App
        {...params}
        debugMode={debugMode}
        onInitStateManager={handleInitStateManager}
        onInitEventBridge={handleInitEventBridge}
      >
        {pluginKeys.map(pluginType => (
          <Sdk.Plugin key={pluginType} renderType={pluginType} component={plugins[pluginType]} />
        ))}
      </App>
    );
  };

  const root = ReactDOM.createRoot(document.getElementById(widgetContainer));
  root.render(<Widget />);
}

if (typeof window !== 'undefined' && window.plitziCache) {
  // SSR
  const debugMode = false;
  if (process.env.NODE_ENV === 'production' && !debugMode && typeof window !== 'undefined') {
    disableReactDevTools();
  }

  // if (window.plitziCachePlugins) {
  //   generatePluginPromises(window.plitziCachePlugins).then(pluginsProcessed => {
  //     ReactDOM.hydrateRoot(
  //       document.getElementById('plitzi-sdk-root'),
  //       <App {...window.plitziCache} debugMode={debugMode}>
  //         {pluginsProcessed.map(({ type, Component }) => (
  //           <Sdk.Plugin key={type} renderType={type} component={Component} />
  //         ))}
  //       </App>
  //     );
  //   });
  // } else {
  //   ReactDOM.hydrateRoot(
  //     document.getElementById('plitzi-sdk-root'),
  //     <App {...window.plitziCache} debugMode={debugMode} />
  //   );
  // }

  ReactDOM.hydrateRoot(
    document.getElementById('plitzi-sdk-root'),
    <App {...(window.plitziCache ?? {})} debugMode={debugMode} />
  );
}

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
 * }} props
 * @returns {React.ReactElement}
 */
const PlitziSdk = props => {
  const {
    debugMode = false,
    // App
    children,
    // Space
    webKey = '',
    environment = 'main',
    // Extra
    renderMode = RENDER_MODE_IFRAME,
    ...otherProps
  } = props;

  return (
    <App {...otherProps} renderMode={renderMode} debugMode={debugMode} webKey={webKey} environment={environment}>
      {children}
    </App>
  );
};

PlitziSdk.Plugin = Sdk.Plugin;

export {
  ComponentProvider,
  ComponentContext,
  usePlitziServiceContext,
  PlitziServiceProvider,
  RootElement,
  withElement,
  JsxManager,
  PluginManager,
  PluginRemote,
  ReplicaProvider,
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET,
  sdkComponents
};

export const version = VERSION;

export const getStateManager = () => stateManager;

export const getEventBridge = () => eventBridge;

export default PlitziSdk;
