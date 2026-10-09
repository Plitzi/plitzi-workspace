/* eslint-disable react-refresh/only-export-components */

import { useCallback, useEffect, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

// This one it is important due that there its a circular import, so we need to import ComponentProvider in a specific order

import sdkComponents from '@modules/Element';
import Sdk from '@modules/Sdk';
import {
  createShaderProgram,
  ShaderError,
  useAnimationFrame,
  useCanvas2d,
  useReducedMotion,
  useWebGL,
  useWebGL2
} from '@plitzi/sdk-elements/canvas';
import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import useFlag from '@plitzi/sdk-elements/dataSource/useFlag';
import elementChildren from '@plitzi/sdk-elements/Element/helpers/elementChildren';
import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import useElement from '@plitzi/sdk-elements/Element/hooks/useElement';
import useElementVisible from '@plitzi/sdk-elements/Element/hooks/useElementVisible';
import usePluginTrigger from '@plitzi/sdk-elements/Element/hooks/usePluginTrigger';
import useRscData from '@plitzi/sdk-elements/Element/hooks/useRscData';
import JsxManager from '@plitzi/sdk-elements/Element/JsxManager';
import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import PluginRemote from '@plitzi/sdk-elements/Element/PluginRemote';
import ReplicaProvider from '@plitzi/sdk-elements/Element/ReplicaProvider';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import useChannel from '@plitzi/sdk-elements/realtime/useChannel';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { disableReactDevTools } from '@plitzi/sdk-shared/helpers/security';
import baseUsePlitziServiceContext, { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import useRscRefresh from '@plitzi/sdk-shared/server/rsc/useRscRefresh';
import usePluginRoute from '@plitzi/sdk-shared/server/usePluginRoute';
import { useSdkStore, recordRenderActionRuns, DEFAULT_RENDER_SETTINGS } from '@plitzi/sdk-shared/store';
import { styleCacheFromDocument } from '@plitzi/sdk-shared/style';
import useDisplayMode from '@plitzi/sdk-shared/style/useDisplayMode';
import useElementSize from '@plitzi/sdk-shared/style/useElementSize';

import App from './App';
import { getEnvironmentServer } from './config';
import { track } from './modules/Analytics';
import { deferredPlugin } from './modules/Sdk/deferredPlugins';
import { createHotPlugins } from './modules/Sdk/hotPlugins';

// SDK Style
import './assets/plitzi-sdk.scss';
if (import.meta.env.PROD) {
  void import('./assets/plitzi-sdk-devtools.scss');
}

import type { DeferredPlugin, PluginComponent } from './modules/Sdk/deferredPlugins';
import type { CanvasHandle, CanvasOptions, CanvasSize, Frame } from '@plitzi/sdk-elements/canvas';
import type { ElementContextValue } from '@plitzi/sdk-elements/Element/ElementContext';
import type { ElementChild } from '@plitzi/sdk-elements/Element/helpers/elementChildren';
import type { PluginTriggerPayload } from '@plitzi/sdk-elements/Element/hooks/usePluginTrigger';
import type { ChannelHandle } from '@plitzi/sdk-elements/realtime/useChannel';
import type { EventBridgeContextValue } from '@plitzi/sdk-event-bridge';
import type {
  ActionRunSummary,
  AnalyticsConfig,
  Element,
  Schema,
  Style,
  ComponentPluginFC,
  ComponentPlugin,
  InteractionCallback,
  InteractionCallbackParamValues,
  Environment,
  HostActions,
  OfflineDataRaw,
  RenderMode,
  Server,
  RuntimeStateInstance,
  Theme,
  ThemeScope,
  PlitziServiceContextValue as BasePlitziServiceContextValue
} from '@plitzi/sdk-shared';
import type { RealtimeMessage } from '@plitzi/sdk-shared';
import type { PluginDeclaration } from '@plitzi/sdk-shared/authoring/declare';
import type { RealtimeMember } from '@plitzi/sdk-shared/realtime';
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

/**
 * Puts back the stylesheet a server-rendered page left out of its payload (see `styleCacheTravelsInDocument`), read
 * from the runtime `<style>` the server rendered under `root` — before hydration, so the first render in the browser
 * draws the stylesheet the server drew.
 */
const withDocumentStyleCache = <P extends PlitziSdkProps>(params: P, root: HTMLElement | null | undefined): P => {
  const { offlineData } = params;
  if (!offlineData || !root) {
    return params;
  }

  const cache = styleCacheFromDocument(root);
  if (cache === undefined) {
    // The server leaves the cache out only of a page it rendered it into, so the document was changed on the way.
    console.error('[plitzi] The server-rendered stylesheet is missing from the page: it renders without its styles.');

    return params;
  }

  return { ...params, offlineData: { ...offlineData, style: { ...offlineData.style, cache } } };
};

/**
 * A registered plugin is a COMPONENT, not a decorated one.
 *
 * `ComponentPluginFC` and not `ComponentPlugin`, because the metadata the latter carries — `type`, `assets`,
 * `origin`, `content` — is stamped on by `App` when it reads these, from the very keys given here. Asking a
 * caller for it made the parameter impossible to satisfy without a cast: everybody registering a component of
 * their own has a React component and nothing else, which is also exactly what `<Sdk.Plugin component>` declares.
 */
type RenderPluginBase = {
  props?: Record<string, unknown>;
  clientOnly?: boolean;
};

export type RenderPlugins = Record<
  string,
  | (RenderPluginBase & {
      /**
       * A plugin's props ARE the hosting element's attributes, which this package cannot know — so the parameter is
       * left open. Narrowed to `ComponentPluginFC` with its default `unknown`, it refuses every component anybody
       * actually writes: a component declaring `{ label?: string }` has nothing in common with the runtime-supplied
       * props alone, and TypeScript reads that as a mistake rather than as the intended widening.
       */
      component: PluginComponent;
    })
  /** One the page draws none of — see `deferredPlugin`. */
  | (RenderPluginBase & DeferredPlugin)
>;

export type RenderOptions = {
  /**
   * Development: the page's plugins can be swapped while it runs (`replacePlugin` on what `render` returns) — what a
   * server rebuilding a plugin hands an open page, so an edit shows without loading the page again.
   */
  hotPlugins?: boolean;
};

export function render(
  widgetContainer: string,
  params = {} as PlitziSdkProps,
  renderPlugins: RenderPlugins = {},
  debugMode = false,
  ssrMode = false,
  { hotPlugins = false }: RenderOptions = {}
) {
  const registered = Object.fromEntries(
    Object.entries(renderPlugins).map(([key, plugin]) => {
      if ('component' in plugin) {
        return [key, plugin];
      }

      const { load, css, declaration, ...rest } = plugin;

      return [key, { ...rest, component: deferredPlugin(key, { load, css, declaration }) }];
    })
  );
  const hot = hotPlugins ? createHotPlugins(registered) : undefined;
  const plugins = hot?.plugins ?? registered;
  /**
   * The runs the SERVER did while building this page, kept out of what the tree is rendered with.
   *
   * They are a record, not a prop: nothing on the page reads them, and they reach the dev-tools through the same
   * log every client-side run goes into. A server sends them only to a page it authorized for debugging.
   */
  const { actionRuns, styleCacheInDocument, ...derivedParams } = withDerivedAnalytics(params);
  const rootDOM = typeof document !== 'undefined' ? document.getElementById(widgetContainer) : undefined;
  const renderParams = styleCacheInDocument ? withDocumentStyleCache(derivedParams, rootDOM) : derivedParams;
  /**
   * Two ways to authorize the dev tools, and the params win.
   *
   * The positional argument is what the server-rendered bootstrap passes, because at that point the page's own
   * data is one interpolated blob it cannot add a key to. Everybody else writes `debugMode` beside the rest of
   * the options — it is on `PlitziSdkProps`, `<PlitziSdk debugMode />` honours it, and a `render()` that quietly
   * dropped it would be the same option meaning two different things depending on which door you came through.
   */
  const debugAuthorized = renderParams.debugMode ?? debugMode;
  if (debugAuthorized && actionRuns?.length) {
    recordRenderActionRuns(actionRuns);
  }

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

  if (!rootDOM) {
    return undefined;
  }

  const root = ssrMode ? hydrateRoot(rootDOM, <Widget isHydrating />) : createRoot(rootDOM);
  if (!ssrMode) {
    root.render(<Widget />);
  }

  /**
   * How to take it down again.
   *
   * Returned rather than kept private because a second `render()` into the same element creates a SECOND React
   * root over the first — two trees on one node, both live, neither aware of the other. Anything that re-renders
   * on its own needs to unmount first, and hot module replacement is the case that made this necessary: a dev
   * server that swaps a module has to remount the tree, and without a handle its only option was to reload the
   * whole page.
   */
  return {
    unmount: () => root.unmount(),
    /**
     * Swaps a plugin where it is drawn, with `hotPlugins` on: `false` when it cannot be swapped in place — not
     * registered by this page, or its declaration changed — and the page should load again.
     */
    replacePlugin: (key: string, component: PluginComponent): boolean => hot?.replace(key, component) ?? false
  };
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
  /**
   * Whether this space owns the browser's address bar. `browser` (the default) is right when the space IS the page.
   *
   * `memory` is for a space EMBEDDED in an application that has a router of its own — the desktop app, a component
   * mounted in a host: without it the space's own navigation rewrites the host's location, and a reload then opens
   * the host's index with the space gone.
   */
  routing?: 'browser' | 'memory';
  debugMode?: boolean;
  /** What the server ran to build this page, for the dev-tools. Only ever sent to a page allowed to debug them. */
  actionRuns?: ActionRunSummary[];
  /**
   * The feature flags this embedding decides, by name: `{ newCheckout: true }`. Above whatever the space and the server
   * rendering it say, below a tester with the dev tools. Only for flags the space declares — anything else is ignored,
   * with a warning in the console.
   */
  flags?: Record<string, boolean>;
  /** Set by the server that rendered this page: the flags its deployment decides (`createServer({ flags })`). */
  serverFlags?: Record<string, boolean>;
  /**
   * Set by the server that rendered this page for somebody allowed to debug it: the flags a tester forced, read from
   * the cookie the dev tools write — so the page hydrates drawn the way the server drew it.
   */
  forcedFlags?: Record<string, boolean>;
  /**
   * Set by the server that rendered this page: `offlineData.style.cache` was left out of the payload because the
   * page's own stylesheet holds it, and `render()` reads it back from there before hydrating.
   */
  styleCacheInDocument?: boolean;
  isHydrating?: boolean;
  previewMode?: boolean;
  /** Set by the server that metered this render: the account behind this space is over its quota, so the page says
   *  so. Never authored — a space cannot turn it off from its own settings. */
  overQuota?: boolean;
  externalStyle?: string;
  sdkDevToolsStylePath?: string;
  /** Where Font Awesome's sheet is served, for the panels the SDK draws in a root of their own (the dev tools, the
   *  `iframe` and `shadow` render modes). Defaults to `/plitzi-sdk-icons.css`, beside the SDK's own stylesheet. */
  sdkIconsStylePath?: string;
  /** Where this render reports SPA navigations and interactions, and with what key. Injected by a server that
   *  renders the page; derived from `server` + `webKey` for a client-side render; absent means report nothing. */
  analytics?: AnalyticsConfig;
  state?: Record<string, unknown>;
  /**
   * What the application EMBEDDING this space hands it, published as the `host` data source.
   *
   * The half that makes an application SHELL authorable: a sidebar cannot list the host's screens unless the host
   * can give it the list. Kept current while the space is on screen — unlike `state`, which the space owns from
   * the moment it mounts.
   */
  hostData?: Record<string, unknown>;
  /**
   * What that application is willing to be asked to do, reached from a flow with the `hostAction` step.
   *
   * The only way out of a space and into its host: opening one of the host's screens, signing out of its keyring,
   * quitting. A name the host does not register does nothing.
   */
  hostActions?: HostActions;
  /**
   * Whose theme this space follows and repaints. `document` (the default) is a space that IS the page.
   *
   * `container` is a space EMBEDDED in an application with a theme of its own: it wears the class on its own root
   * and keeps a theme store of its own, so toggling it never reaches the application around it, and two spaces in
   * one document do not answer for each other.
   */
  themeScope?: ThemeScope;
  /** The theme the host already settled — from the cookie a server read before it rendered the document. */
  theme?: Theme;
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

type PlitziServiceContextValue = BasePlitziServiceContextValue;

const usePlitziServiceContext = baseUsePlitziServiceContext;

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
  useRscData,
  // Whether another element is on the page, for a plugin that acts when it appears: a window a flow opened.
  useElementVisible,
  // Fires one of a plugin's declared events, typed by its declaration — on a live page, never on the builder's canvas.
  usePluginTrigger,
  // A plugin that lays out the space's elements put inside it — a dock, tabs, a masonry: each child with its id, to
  // wrap in a box of its own rather than restyling an element that is not its own.
  elementChildren,
  // Which of the space's breakpoints the page shows, by the widths its styles are compiled at.
  useDisplayMode,
  // The size a plugin's own box is drawn at — narrower than the window beside a sidebar, wider than `mobile` says on a
  // tablet held upright — `undefined` until measured, so the server's page and the hydrated one agree.
  useElementSize,
  // The other half of `useRscData`. An element whose data is resolved on the server could read the payload and had
  // no way to ask for a fresh one — so anything that has to keep up with a feed had to fetch it itself from the
  // browser, which is the whole thing a server-resolved element exists to avoid.
  useRscRefresh,
  // A plugin's own server half (its `functions/`): the URL of one of its routes, `/fn/plugins/<type>/…`, with
  // nothing for the space to wire.
  usePluginRoute,
  // A realtime channel, for a plugin that moves at the speed of a cursor: the `channel` element's own connection,
  // read without a flow per message.
  useChannel,
  // One of the space's feature flags, for a plugin that ships a feature behind one: whatever every layer decided.
  useFlag,
  // A plugin that draws: a loop that runs only while somebody can see it move, and a canvas sized to the device, with
  // a still frame where it may not animate and an error that says why instead of an empty canvas.
  useAnimationFrame,
  useReducedMotion,
  useCanvas2d,
  useWebGL,
  useWebGL2,
  createShaderProgram,
  ShaderError
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
  InteractionCallbackParamValues,
  PluginDeclaration,
  PluginTriggerPayload,
  ChannelHandle,
  ElementChild,
  RealtimeMember,
  RealtimeMessage,
  CanvasHandle,
  CanvasOptions,
  CanvasSize,
  Frame
};

export const version = typeof VERSION !== 'undefined' ? VERSION : '';

export const getStateManager = () => stateManager;

export const getEventBridge = () => eventBridge;

export default PlitziSdk;
