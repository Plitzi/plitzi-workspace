/* eslint-disable react-refresh/only-export-components */

import { useCallback } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

// This one it is important due that there its a circular import, so we need to import ComponentProvider in a specific order
// eslint-disable-next-line import/order
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import sdkComponents from '@modules/Element';
import Sdk from '@modules/Sdk';
import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import JsxManager from '@plitzi/sdk-elements/Element/JsxManager';
import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import PluginRemote from '@plitzi/sdk-elements/Element/PluginRemote';
import ReplicaProvider from '@plitzi/sdk-elements/Element/ReplicaProvider';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext, { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import App from './App';
import { disableReactDevTools } from './helpers/security';

// SDK Style
import './assets/index.scss';

import type { OfflineDataRaw } from './types';
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

let stateManager: StateManagerContextValue;
let eventBridge: EventBridgeContextValue;

export function render(
  widgetContainer: string,
  params = {} as PlitziSdkProps,
  plugins: Record<string, ComponentPlugin> = {},
  debugMode = false
) {
  const Widget = () => {
    const pluginKeys = Object.keys(plugins);
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }

    const handleInitStateManager = useCallback((instance: StateManagerContextValue) => {
      stateManager = instance;
    }, []);

    const handleInitEventBridge = useCallback((instance: EventBridgeContextValue) => {
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

  const rootDOM = document.getElementById(widgetContainer);
  if (rootDOM) {
    const root = createRoot(rootDOM);
    root.render(<Widget />);
  }
}

declare global {
  interface Window {
    plitziCache?: PlitziSdkProps;
  }
}

if (typeof window !== 'undefined' && window.plitziCache) {
  // SSR
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    disableReactDevTools();
  }

  // if (window.plitziCachePlugins) {
  //   generatePluginPromises(window.plitziCachePlugins).then(pluginsProcessed => {
  //     hydrateRoot(
  //       document.getElementById('plitzi-sdk-root'),
  //       <App {...window.plitziCache} debugMode={debugMode}>
  //         {pluginsProcessed.map(({ type, Component }) => (
  //           <Sdk.Plugin key={type} renderType={type} component={Component} />
  //         ))}
  //       </App>
  //     );
  //   });
  // } else {
  //   hydrateRoot(
  //     document.getElementById('plitzi-sdk-root'),
  //     <App {...window.plitziCache} debugMode={debugMode} />
  //   );
  // }

  const elementDOM = document.getElementById('plitzi-sdk-root');
  if (elementDOM) {
    hydrateRoot(elementDOM, <App {...(window.plitziCache ?? {})} debugMode={false} />);
  }
}

export type PlitziSdkProps = {
  className?: string;
  children?: ReactNode;
  cacheTimeout?: number;
  revision?: number;
  webKey: string;
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
};

const PlitziSdk = ({
  debugMode = false,
  // App
  children,
  // Space
  webKey,
  environment = 'main',
  // Extra
  renderMode = 'iframe',
  ...otherProps
}: PlitziSdkProps) => {
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
  sdkComponents
};

export const version = typeof VERSION !== 'undefined' ? VERSION : '';

export const getStateManager = () => stateManager;

export const getEventBridge = () => eventBridge;

export default PlitziSdk;
