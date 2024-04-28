// Debugger helper
import './helpers/wdyr';

// Packages
import React, { useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';
import ComponentProvider from '@modules/Component/ComponentProvider';
import RootElement from '@modules/Element/RootElement';
import Sdk, {
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
} from '@modules/Sdk';
import { generatePluginPromises } from '@modules/Element/helpers/elementUtils';

// Relatives
import { disableReactDevTools } from './helpers/security';
import usePlitziServiceContext, { PlitziServiceProvider } from './services/hooks/usePlitziServiceContext';
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

  if (window.plitziCachePlugins) {
    generatePluginPromises(window.plitziCachePlugins).then(pluginsProcessed => {
      ReactDOM.hydrateRoot(
        document.getElementById('plitzi-sdk-root'),
        <App {...window.plitziCache}>
          {pluginsProcessed.map(({ type, Component }) => (
            <Sdk.Plugin key={type} renderType={type} component={Component} />
          ))}
        </App>
      );
    });
  } else {
    ReactDOM.hydrateRoot(document.getElementById('plitzi-sdk-root'), <App {...window.plitziCache} />);
  }
}

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

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }
  }, []);

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
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
};

export const version = VERSION;

export const getStateManager = () => {
  return stateManager;
};

export const getEventBridge = () => {
  return eventBridge;
};

export default PlitziSdk;
