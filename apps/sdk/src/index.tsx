/* eslint-disable react-refresh/only-export-components */

import { useCallback } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

// This one it is important due that there its a circular import, so we need to import ComponentProvider in a specific order
import sdkComponents from '@modules/Element';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
// eslint-disable-next-line import/order
import Sdk from '@modules/Sdk';
import ElementContext from '@plitzi/sdk-elements/Element/ElementContext';
import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import useElement from '@plitzi/sdk-elements/Element/hooks/useElement';
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

import type {
  Schema,
  Style,
  ComponentPluginFC,
  ComponentPlugin,
  InteractionCallback,
  InteractionCallbackParamValues,
  Environment,
  EventBridgeContextValue,
  OfflineDataRaw,
  RenderMode,
  Server,
  ServerEnvironment,
  StateManagerContextValue,
  PlitziServiceContextValue
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

let stateManager: StateManagerContextValue;
let eventBridge: EventBridgeContextValue;

export function render(
  widgetContainer: string,
  params = {} as PlitziSdkProps,
  plugins: Record<string, ComponentPlugin> = {},
  debugMode = false,
  ssrMode = false
) {
  const Widget = ({ isHydrating = false }: { isHydrating?: boolean }) => {
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
        isHydrating={isHydrating}
        onInitStateManager={handleInitStateManager}
        onInitEventBridge={handleInitEventBridge}
      >
        {pluginKeys.map(pluginType => (
          <Sdk.Plugin key={pluginType} renderType={pluginType} component={plugins[pluginType]} />
        ))}
      </App>
    );
  };

  const rootDOM = typeof document !== 'undefined' ? document.getElementById(widgetContainer) : undefined;
  if (!rootDOM) {
    return;
  }

  if (!ssrMode) {
    createRoot(rootDOM).render(<Widget />);
  } else {
    hydrateRoot(rootDOM, <Widget isHydrating />);
  }
}

declare global {
  interface Window {
    plitziCache?: PlitziSdkProps;
  }
}

export type PlitziSdkProps = {
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
  isHydrating?: boolean;
  previewMode?: boolean;
  externalStyle?: string;
  state?: Record<string, unknown>;
};

const PlitziSdk = ({
  debugMode = false,
  isHydrating = false,
  // App
  children = undefined,
  // Space
  webKey = '',
  environment = 'main',
  // Extra
  renderMode = 'iframe',
  ...otherProps
}: PlitziSdkProps) => {
  return (
    <App
      {...otherProps}
      isHydrating={isHydrating}
      renderMode={renderMode}
      debugMode={debugMode}
      webKey={webKey}
      environment={environment}
    >
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
  sdkComponents,
  PluginRemote,
  ReplicaProvider,
  useElement,
  ElementContext
};

export type {
  Schema,
  Style,
  ComponentPlugin,
  ComponentPluginFC,
  PlitziServiceContextValue,
  OfflineDataRaw,
  InteractionCallback,
  InteractionCallbackParamValues
};

export const version = typeof VERSION !== 'undefined' ? VERSION : '';

export const getStateManager = () => stateManager;

export const getEventBridge = () => eventBridge;

export default PlitziSdk;
