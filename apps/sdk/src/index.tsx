/* eslint-disable react-refresh/only-export-components */

import { useCallback } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

// This one it is important due that there its a circular import, so we need to import ComponentProvider in a specific order

import sdkComponents from '@modules/Element';
import Sdk from '@modules/Sdk';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import useElement from '@plitzi/sdk-elements/Element/hooks/useElement';
import useRscData from '@plitzi/sdk-elements/Element/hooks/useRscData';
import JsxManager from '@plitzi/sdk-elements/Element/JsxManager';
import { PlitziElementsProvider } from '@plitzi/sdk-elements/Element/PlitziElementsProvider';
import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import PluginRemote from '@plitzi/sdk-elements/Element/PluginRemote';
import ReplicaProvider from '@plitzi/sdk-elements/Element/ReplicaProvider';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { disableReactDevTools } from '@plitzi/sdk-shared/helpers/security';
import baseUsePlitziServiceContext, { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import App from './App';

// SDK Style
import './assets/plitzi-sdk.scss';
if (import.meta.env.PROD) {
  void import('./assets/plitzi-sdk-devtools.scss');
}

import type { ElementContextValue } from '@plitzi/sdk-elements/Element/ElementContext';
import type EventBridge from '@plitzi/sdk-event-bridge';
import type InteractionsManager from '@plitzi/sdk-interactions/InteractionsManager';
import type {
  Element,
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
  RuntimeStateInstance,
  PlitziServiceContextValue as BasePlitziServiceContextValue
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

let stateManager: RuntimeStateInstance;
let eventBridge: EventBridgeContextValue;

export function render(
  widgetContainer: string,
  params = {} as PlitziSdkProps,
  plugins: Record<string, { component: ComponentPlugin; props?: Record<string, unknown> }> = {},
  debugMode = false,
  ssrMode = false
) {
  const Widget = ({ isHydrating = false }: { isHydrating?: boolean }) => {
    const pluginKeys = Object.keys(plugins);
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }

    const handleInitStateManager = useCallback((instance: RuntimeStateInstance) => {
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
        {pluginKeys
          .filter(pluginType => !!(plugins[pluginType].component as ComponentPlugin | undefined))
          .map(pluginType => (
            <Sdk.Plugin
              key={pluginType}
              renderType={pluginType}
              component={plugins[pluginType].component}
              {...plugins[pluginType].props}
            />
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
  server?: Partial<Server>;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
  renderMode?: RenderMode;
  debugMode?: boolean;
  isHydrating?: boolean;
  previewMode?: boolean;
  externalStyle?: string;
  sdkDevToolsStylePath?: string;
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

type PlitziServiceContextValue = BasePlitziServiceContextValue<
  InstanceType<typeof EventBridge>,
  InstanceType<typeof InteractionsManager>
>;

const usePlitziServiceContext = baseUsePlitziServiceContext as () => PlitziServiceContextValue;

export {
  ComponentProvider,
  ComponentContext,
  usePlitziServiceContext,
  PlitziServiceProvider,
  PlitziElementsProvider,
  RootElement,
  withElement,
  JsxManager,
  PluginManager,
  sdkComponents,
  PluginRemote,
  ReplicaProvider,
  useElement,
  useRscData
};

export type {
  ElementContextValue,
  Element,
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
