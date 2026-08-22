import { ApolloProvider } from '@apollo/client/react';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { buttonTheme } from '@plitzi/plitzi-ui/Button';
import { containerCollapsableTheme } from '@plitzi/plitzi-ui/ContainerCollapsable';
import { containerResizableTheme } from '@plitzi/plitzi-ui/ContainerResizable';
import ContainerRoot from '@plitzi/plitzi-ui/ContainerRoot';
import { containerTabsTheme } from '@plitzi/plitzi-ui/ContainerTabs';
import { contentEditableTheme } from '@plitzi/plitzi-ui/ContentEditable';
import { headingTheme } from '@plitzi/plitzi-ui/Heading';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { inputTheme } from '@plitzi/plitzi-ui/Input';
import { markdownTheme } from '@plitzi/plitzi-ui/Markdown';
import Provider from '@plitzi/plitzi-ui/Provider';
import { textTheme } from '@plitzi/plitzi-ui/Text';
import clsx from 'clsx';
import { useEffect, Children, isValidElement, useMemo, useCallback, useRef, Fragment } from 'react';
import { BrowserRouter, StaticRouter } from 'react-router-dom';

import { initClient } from '@modules/App/AppHelper';
import AppMain from '@modules/App/AppMain';
import useDebugShortcut from '@modules/App/useDebugShortcut';
import sdkComponents from '@modules/Element';
import SdkPlugin from '@modules/Sdk/SdkPlugin';
import { historyMiddleware as historyMw, loggerMiddleware as loggerMw } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import { createStoreDevToolsLogger, ThemeProvider, type SdkState } from '@plitzi/sdk-shared';
import { debugCookieName } from '@plitzi/sdk-shared/devTools';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';
import { runtimeStatePersist } from '@plitzi/sdk-shared/state/runtimeStatePersist';
import { DEFAULT_RENDER_SETTINGS } from '@plitzi/sdk-shared/store';
import { tracingCollector, tracingMiddleware } from '@plitzi/sdk-shared/store/tracing';

import { getEnvironmentServer } from './config';

import type { ApolloClient } from '@apollo/client/core';
import type { SdkPluginProps } from '@modules/Sdk/SdkPlugin';
import type {
  AnalyticsConfig,
  ComponentPlugin,
  ComponentPluginFC,
  Environment,
  EventBridgeContextValue,
  OfflineDataRaw,
  RenderMode,
  Server,
  RuntimeStateInstance
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AppProps = {
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
  /** Reporting channel for this render — see {@link AnalyticsConfig}. Absent means report nothing. */
  analytics?: AnalyticsConfig;
  state?: Record<string, unknown>;
  onInitStateManager?: (instance: RuntimeStateInstance) => void;
  onInitEventBridge?: (instance: EventBridgeContextValue) => void;
};

const components = {
  Button: buttonTheme,
  ContentEditable: contentEditableTheme,
  Input: inputTheme,
  Heading: headingTheme,
  ContainerResizable: containerResizableTheme,
  ContainerCollapsable: containerCollapsableTheme,
  Text: textTheme,
  Markdown: markdownTheme,
  ContainerTabs: containerTabsTheme
};

const App = ({
  className = 'min-h-screen',
  children,
  // Space
  webKey = '',
  // Server
  server = undefined,
  // Extra
  renderMode = DEFAULT_RENDER_SETTINGS.renderMode,
  debugMode: debugModeProp = false,
  state,
  ...sdkProps
}: AppProps) => {
  const webId = useMemo(() => getKeyDecoded(webKey, true), [webKey]);
  // Initialize `runtime.state` once at the root from the host-provided initial state; persist/interactions own it
  // afterwards. Captured at mount (stable value → no re-sync that would reset the sibling `runtime.sources`).
  const initialState = useRef(state).current;
  // `render` is initialized here so the slice exists — with the shared floor — from the store's very first state;
  // `AppMain` syncs the values this render actually has over it, and keeps them true as debugMode toggles.
  const storeValue = useMemo<Partial<SdkState>>(
    () => ({
      segments: {},
      runtime: { sources: {}, state: initialState ?? {} },
      render: DEFAULT_RENDER_SETTINGS
    }),
    [initialState]
  );
  /**
   * Two different things, and only one of them is trusted. The `debugMode` prop is the page's authorization —
   * whoever embedded the SDK decided this site may be inspected. The cookie is the visitor's preference *within*
   * that, kept in a cookie so the SSR render matches what the client hydrates with (apps/server prepareRender
   * reads the same name back).
   *
   * A cookie can therefore turn debugging OFF, never ON: it is client-owned, and a published site whose visitors
   * could set it would hand any of them the panel, the element ids and the store. The shortcut below is only one of
   * the ways to write it.
   *
   * The name carries the port, because a cookie's scope does not — see `debugCookieName`.
   */
  const debugCookie = useMemo(
    () => debugCookieName(typeof window === 'undefined' ? undefined : window.location.host),
    []
  );
  const [debugPreference, setDebugPreference] = useStorage(debugCookie, debugModeProp, 'cookie');
  const debugMode = debugModeProp && debugPreference;
  const finalServer = useMemo(() => getEnvironmentServer(server), [server]);
  const client = useMemo<ApolloClient>(() => initClient(finalServer, webKey), [finalServer, webKey]);

  useEffect(() => {
    console.log(
      '%cHello! We are hiring people like you! Reach us at contact@plitzi.com!',
      'background: linear-gradient(60deg, #01d0e2 0%, #4422ee 100%);\n  color: white;\n  display: block;\n  line-height: 25px;\n  height: 25px;\n  padding: 5px;'
    );
  }, []);

  const handleToggleDebug = useCallback(() => setDebugPreference(state => !state), [setDebugPreference]);
  useDebugShortcut({ authorized: debugModeProp, onToggle: handleToggleDebug });

  /**
   * The one state that is otherwise a dead end: the page allows debugging and the visitor has hidden it.
   *
   * There is nothing on screen at that point — no badge, no panel, nothing to click — so somebody who pressed
   * the shortcut once, or arrived after somebody else did, sees a page that simply has no dev tools and no
   * reason to think that is a preference rather than the truth. This line is the way back.
   */
  useEffect(() => {
    if (debugModeProp && !debugPreference) {
      console.info(
        `[plitzi] The dev tools are available here and currently hidden. Press shift+alt+D (or shift+F12) to show them, or clear the "${debugCookie}" cookie.`
      );
    }
  }, [debugModeProp, debugPreference, debugCookie]);

  // Tells the render profiler this app hydrated SSR output, so it can label the hydration commit (a pure client mount
  // looks identical at the React-phase level).
  useEffect(() => {
    if (sdkProps.isHydrating) {
      tracingCollector.setHydrated();
    }
  }, [sdkProps.isHydrating]);

  const localCustomComponents = useMemo(() => {
    const components: Record<string, ComponentPlugin> = {};
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type !== SdkPlugin) {
        return;
      }

      const { renderType, component: componentFC, assets = [], ...extraProps } = child.props as SdkPluginProps;
      if (!renderType || !(componentFC as ComponentPluginFC | undefined)) {
        return;
      }

      const component = componentFC as ComponentPlugin;
      component.type = renderType;
      component.assets = assets;
      component.extraProps = extraProps;
      components[renderType] = component;
    });

    return components;
  }, [children]);

  const routerParams = {} as { location: Location | string };
  if (typeof window === 'undefined') {
    routerParams.location = finalServer.requestUrl ?? '';
  }

  const ReactRouter = renderMode === 'widget' ? Fragment : typeof window === 'undefined' ? StaticRouter : BrowserRouter;
  const reactRouterProps =
    renderMode === 'widget'
      ? {}
      : {
          basename: get(finalServer, 'basePath', '/'),
          location: typeof window === 'undefined' ? (finalServer.requestUrl ?? '') : undefined
        };

  return (
    <StoreProvider
      value={storeValue}
      middlewares={[
        loggerMw(createStoreDevToolsLogger<SdkState>('sdk')),
        runtimeStatePersist<SdkState>(webId),
        ...(debugMode
          ? [
              tracingMiddleware<SdkState>(),
              // Neither element UI state nor the server payload is document state: time-travelling `rsc` would
              // replay a stale server response as if it were an edit.
              historyMw<SdkState>({
                shouldRecord: p => !p?.startsWith('runtime.elements') && !p?.startsWith('rsc')
              })
            ]
          : [])
      ]}
    >
      {/*
        A rendered space follows the machine until a visitor says otherwise — which is what `system` means, and it
        is the only honest default for somebody else's site. The builder is the one that opens in dark.
      */}
      <ThemeProvider defaultTheme="system">
        <Provider components={components}>
          <ContainerRoot className={clsx('plitzi-sdk flex', className, { 'sdk-debug-mode': debugMode })}>
            <HelmetProvider>
              <ReactRouter {...(reactRouterProps as { location: string })}>
                <ApolloProvider client={client}>
                  <ComponentProvider localCustomComponents={localCustomComponents} localComponents={sdkComponents}>
                    <AppMain
                      server={finalServer}
                      webKey={webKey}
                      renderMode={renderMode}
                      debugMode={debugMode}
                      webId={webId}
                      {...sdkProps}
                    />
                  </ComponentProvider>
                </ApolloProvider>
              </ReactRouter>
            </HelmetProvider>
          </ContainerRoot>
        </Provider>
      </ThemeProvider>
    </StoreProvider>
  );
};

export default App;
