/* eslint-disable react-refresh/only-export-components */

import { useCallback, useEffect, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

// This one it is important due that there its a circular import, so we need to import ComponentProvider in a specific order
// eslint-disable-next-line import/order
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import sdkComponents from '@modules/Element';
import Sdk from '@modules/Sdk';
import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import useElement from '@plitzi/sdk-elements/Element/hooks/useElement';
import useRscData from '@plitzi/sdk-elements/Element/hooks/useRscData';
import JsxManager from '@plitzi/sdk-elements/Element/JsxManager';
import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import PluginRemote from '@plitzi/sdk-elements/Element/PluginRemote';
import ReplicaProvider from '@plitzi/sdk-elements/Element/ReplicaProvider';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { disableReactDevTools } from '@plitzi/sdk-shared/helpers/security';
import baseUsePlitziServiceContext, { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useSdkStore, DEFAULT_RENDER_SETTINGS } from '@plitzi/sdk-shared/store';

import App from './App';
import { getEnvironmentServer } from './config';
import { track } from './modules/Analytics';

// SDK Style
import './assets/plitzi-sdk.scss';
if (import.meta.env.PROD) {
  void import('./assets/plitzi-sdk-devtools.scss');
}

import type { ElementContextValue } from '@plitzi/sdk-elements/Element/ElementContext';
import type EventBridge from '@plitzi/sdk-event-bridge';
import type InteractionsManager from '@plitzi/sdk-interactions/InteractionsManager';
import type {
  AnalyticsConfig,
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

/**
 * Fills in the reporting channel for a page that renders entirely in the browser.
 *
 * A server-rendered page is handed its `analytics` config in the bootstrap, because the server that rendered
 * it is the one that knows where its collector lives. A client-side render has no such moment — but it does
 * have the two things the config is made of: the space's public token, and the API it already talks to.
 *
 * Only for a real page: an offline render (an exported widget, an embed carrying its own data) has no backend
 * to report to and must not acquire one by default. And nothing is derived when the host passed a config of
 * its own — a deployment that says where to report is not overridden by a guess.
 */
const withDerivedAnalytics = (params: PlitziSdkProps): PlitziSdkProps => {
  if (params.analytics || params.offlineMode || !params.webKey) {
    return params;
  }

  const { apiServer } = getEnvironmentServer(params.server);
  if (!apiServer) {
    return params;
  }

  return {
    ...params,
    analytics: { endpoint: `${apiServer.replace(/\/+$/, '')}/v1/collect`, key: params.webKey }
  };
};

export function render(
  widgetContainer: string,
  params = {} as PlitziSdkProps,
  plugins: Record<string, { component: ComponentPlugin; props?: Record<string, unknown>; clientOnly?: boolean }> = {},
  debugMode = false,
  ssrMode = false
) {
  const renderParams = withDerivedAnalytics(params);
  /**
   * Two ways to authorize the dev tools, and the params win.
   *
   * The positional argument is what the server-rendered bootstrap passes, because at that point the page's own
   * data is one interpolated blob it cannot add a key to. Everybody else writes `debugMode` beside the rest of
   * the options — it is on `PlitziSdkProps`, `<PlitziSdk debugMode />` honours it, and a `render()` that quietly
   * dropped it would be the same option meaning two different things depending on which door you came through.
   */
  const debugAuthorized = renderParams.debugMode ?? debugMode;

  const Widget = ({ isHydrating = false }: { isHydrating?: boolean }) => {
    // A plugin the server did not render has no markup in the document being hydrated, so mounting it on the first
    // pass is a mismatch — and React answers a mismatch by discarding the whole tree it happened in, not just the
    // offending node. Holding it back for one commit costs a frame and keeps the rest of the page hydrated.
    const [hydrated, setHydrated] = useState(!isHydrating);
    useEffect(() => setHydrated(true), []);

    const pluginKeys = Object.keys(plugins).filter(key => hydrated || !plugins[key].clientOnly);
    if (process.env.NODE_ENV === 'production' && !debugAuthorized) {
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
        {...renderParams}
        debugMode={debugAuthorized}
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
  /** Shows the "Made in Plitzi" link over the rendered space; off for embeds that are not a Plitzi site of their
   *  own (an MCP widget rendered inside a chat, a component mounted in a host app). */
  branding?: boolean;
  externalStyle?: string;
  sdkDevToolsStylePath?: string;
  /** Where this render reports SPA navigations and interactions, and with what key. Injected by a server that
   *  renders the page; derived from `server` + `webKey` for a client-side render; absent means report nothing. */
  analytics?: AnalyticsConfig;
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
  renderMode = DEFAULT_RENDER_SETTINGS.renderMode,
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
  track,
  useSdkStore as useStore,
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
  useRscData
};

export type {
  AnalyticsConfig,
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
