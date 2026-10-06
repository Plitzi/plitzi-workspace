import { debugCookieName } from '@plitzi/sdk-shared/devTools';
import { flagUserFromSSR, flagValues, resolveFlags } from '@plitzi/sdk-shared/flags';
import { pluginDeclarationOf, pluginTypesOf } from '@plitzi/sdk-shared/plugins/declaration';
import { pageElementTypes } from '@plitzi/sdk-shared/schema/pageElements';
import { hasServerElements } from '@plitzi/sdk-shared/schema/serverElements';
import { paintedKeys, paintedStateFor } from '@plitzi/sdk-shared/state/paintedState';
import { fontsToHead, fontUrlResolver } from '@plitzi/sdk-shared/style';
import { themeFromCookies } from '@plitzi/sdk-shared/theme';

import { loadPluginComponents } from './loadPluginComponents';
import { registerExternalPlugins } from './registerExternalPlugins';
import { reportMissingPlugins } from './reportMissingPlugins';
import { resolvePageSeo } from './resolvePageSeo';
import { publishSpaceDocument } from './spaceDocument';
import { imagesPathOf } from '../../core/http/stages/images';
import { PREVIEW_TOKEN_PARAM } from '../../core/previewToken';
import { sdkAssetVersion } from '../../core/sdkAssets';
import { resolveActionEndpoint, resolveRscEndpoint } from '../../core/services/resolve';
import { buildServerInfo } from '../../helpers/buildServerInfo';
import { buildOfflineDataCacheKey } from '../../helpers/cache';
import { authorizesDebugging } from '../../helpers/debugAuthorization';
import { requestFlagOverrides } from '../../helpers/flagOverrides';
import { hydrationPayload, spaceDocument } from '../../helpers/hydrationPayload';
import { createOfflineDataLoader } from '../../helpers/offlineDataLoader';
import { ssrPaintedCookieName } from '../../helpers/paintedCookie';
import { readCookie } from '../../helpers/readCookie';
import { resolveDebugMode } from '../../helpers/resolveDebugMode';
import { realtimeModuleFor } from '../realtime';
import { matchRscPage } from '../rsc/matchRscPage';

import type { ComponentProps } from './Component';
import type { TtlCache } from '../../helpers/cache';
import type { RequestMetrics } from '../../helpers/metrics';
import type { PluginManager } from '../../plugins/manager';
import type {
  Environment,
  OfflineDataRaw,
  PluginDeclaration,
  PluginEntry,
  SSRPageServerConfig,
  SSRPlugin,
  SSRRequest,
  SSRTemplateProps,
  Style,
  Theme
} from '@plitzi/sdk-shared';
import type { FC } from 'react';

/** Last resort only: used for a page that declares no SEO title and a deployment that supplies none either. */
const DEFAULT_TITLE = 'Plitzi App';

/**
 * The theme a space declares a first visit starts in, when it declares one other than `system`.
 *
 * `Partial`, because a style document written before themes existed has no `theme` at all, and a published space
 * is rendered from whatever document it was published with.
 */
const declaredTheme = (style: Partial<Pick<Style, 'theme'>> | undefined): Theme | undefined => {
  const declared = style?.theme?.default;

  return declared && declared !== 'system' ? declared : undefined;
};

// A plugin's declaration is read off the component the process imported once, so it is made once per component.
const declarations = new WeakMap<FC, PluginDeclaration>();

const declarationOf = (component: FC): PluginDeclaration => {
  const known = declarations.get(component);
  if (known) {
    return known;
  }

  const declaration = pluginDeclarationOf(component);
  declarations.set(component, declaration);

  return declaration;
};

export type RenderPrep = {
  componentProps: ComponentProps;
  entries: PluginEntry[];
  templateParams: SSRTemplateProps & { offlineData: string };
  /** False for a render that must not be served to anybody else from a cache: it carries this request's own runs. */
  cacheable: boolean;
};

export const prepareRender = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  pluginManager: PluginManager,
  offlineDataCache?: TtlCache<string>,
  metrics?: RequestMetrics,
  offlineDataOverride?: OfflineDataRaw
): Promise<RenderPrep> => {
  const m = <T,>(name: string, fn: () => T | Promise<T>): Promise<T> =>
    metrics ? metrics.measure(name, fn) : Promise.resolve(fn());

  const offlineCacheKey =
    environment !== 'main'
      ? buildOfflineDataCacheKey(spaceId, environment, revision, req.ctx.spaceDeployment?.flagsVersion)
      : undefined;
  // A draft override (an unsaved preview) never touches the adapters or the shared offline-data cache — it is a
  // one-shot render of in-memory edits, so it must not read from nor pollute the persisted-state cache.
  const cachedOfflineStr =
    offlineDataOverride === undefined && offlineCacheKey ? offlineDataCache?.get(offlineCacheKey) : undefined;

  // Shared with the RSC read that runs alongside this one, so the space is fetched once however many of them ask.
  const loadOfflineData = createOfflineDataLoader(() => {
    if (offlineDataOverride !== undefined) {
      return Promise.resolve<OfflineDataRaw | undefined>(offlineDataOverride);
    }

    if (cachedOfflineStr) {
      return Promise.resolve(JSON.parse(cachedOfflineStr) as OfflineDataRaw | undefined);
    }

    return m('schema', () => config.adapters.getOfflineData(spaceId, environment, revision));
  });

  const offlineData = await loadOfflineData();

  // The adapter is asked only when this page has somewhere to put the answer. A space is normally a mix — one page
  // backed by a CMS, the next one static — and resolving is what costs: the providers of THIS page's server
  // elements, each an API call or a connector read. A page holding none of them would pay them for a payload no
  // element ever reads, so it is not asked at all. `{ serverData: {} }` rather than nothing, because that is what
  // the read itself would have returned, and the client treats a missing payload as one still to fetch.
  const rscPath = resolveRscEndpoint(config);
  const schema = offlineData?.schema;
  // Which page this URL addresses is now needed whatever the RSC settings say — the document's own title and
  // description come from it — so the match runs first and the RSC gates below read its answer.
  const pageMatch = schema !== undefined ? matchRscPage(schema, req.path, req.ctx.user) : undefined;
  // Only the explicit `false` is treated as an opt-out here. Whether an ABSENT flag means on or off is the adapter's
  // to decide and the two shipped ones disagree — `resolveRscData` reads it as on, `connectorRscData` as off — so
  // this gate skips on the one answer both of them agree about.
  const rscEnabled = rscPath !== undefined && schema !== undefined && schema.rsc?.enabled !== false;
  // A `__pt` render exists to be looked at as a picture — a thumbnail, the agent's screenshot, the builder's
  // preview pane. Nobody is at that keyboard to dismiss the dev-tools badge, and it would be baked into the
  // capture, so debugging is off for it however the deployment and the cookie are set — and with it, a tester's
  // forced flags. See `debugRendered` below for who may authorize it.
  const isPreviewRender = Boolean(req.query[PREVIEW_TOKEN_PARAM]);
  const debugAuthorized = !isPreviewRender && authorizesDebugging(config, schema?.settings);
  const flagOverrides = await requestFlagOverrides(
    config,
    req,
    {
      spaceId: req.ctx.spaceDeployment?.spaceId ?? spaceId,
      environment: req.ctx.spaceDeployment?.environment ?? environment
    },
    debugAuthorized
  );
  // Resolved here only to know whether a server element of this page is switched on; the page itself resolves them
  // again as it renders, from the same layers.
  const pageFlags =
    schema !== undefined && pageMatch !== undefined
      ? flagValues(
          resolveFlags(
            schema.flags,
            {
              environment: req.ctx.spaceDeployment?.environment ?? environment,
              hostname: req.hostname,
              routeParams: pageMatch.routeParams,
              queryParams: req.query,
              user: flagUserFromSSR(req.ctx.user)
            },
            flagOverrides
          )
        )
      : undefined;
  const hasTargets = rscEnabled && pageMatch !== undefined && hasServerElements(schema, pageMatch.pageId, pageFlags);
  // Timed around the adapter alone, and from after the schema is in hand. An RSC read opens by joining that read —
  // the whole point of sharing the loader — and those milliseconds are already billed to `schema`; timing from the
  // call would report one read under two names and make a page that resolved nothing look like it cost a pass.
  const rscData =
    hasTargets && config.adapters.getRscData
      ? await m('rsc', () =>
          config.adapters.getRscData?.({
            req,
            spaceId: req.ctx.spaceDeployment?.spaceId ?? spaceId,
            environment: req.ctx.spaceDeployment?.environment ?? environment,
            revision: req.ctx.spaceDeployment?.revision ?? revision,
            user: req.ctx.user,
            loadOfflineData,
            flagOverrides
          })
        )
      : rscPath
        ? { serverData: {} }
        : undefined;

  const pageSeo = resolvePageSeo(schema, pageMatch?.pageId);

  const server = buildServerInfo(req, config, {
    rscPath,
    rscData,
    actionPath: resolveActionEndpoint(config),
    realtimePath: realtimeModuleFor(config)?.path,
    realtimeTransport: realtimeModuleFor(config)?.transport,
    imagePath: imagesPathOf(config)
  });

  if (offlineDataOverride === undefined && !cachedOfflineStr && offlineCacheKey && offlineData !== undefined) {
    offlineDataCache?.set(offlineCacheKey, JSON.stringify(offlineData));
  }

  // Falls back to the bundle's own mtime, so the cache-buster is right without anybody supplying one.
  const version = config.assetVersion ?? sdkAssetVersion();
  const v = version ? `?v=${version}` : '';
  const sdkDevToolsStylePath = `/sdk-assets/plitzi-sdk-devtools.css${v}`;
  const sdkIconsStylePath = `/sdk-assets/plitzi-sdk-icons.css${v}`;

  /**
   * Two facts, and they have to leave this server separately.
   *
   * `debugAuthorized` is the deployment's decision and is what the client bootstrap is handed, because on the
   * client that argument is what arms the shortcut and the "currently hidden" console hint. Collapsing the
   * cookie into it — which is what this used to send — made hiding the panel on an SSR page permanent: the page
   * came back authorizing nothing, so the shortcut was dead and nothing on screen or in the console said why.
   *
   * `debugRendered` is what this particular render draws, preference included. The client derives the same
   * product from the same cookie on its first pass, so the markup it hydrates matches.
   *
   * Who may authorize it: the server first, through `debugMode`. When it said nothing, a development server does, and
   * so does the space itself (`settings.debugMode`) — an owner inspecting their own published site. The space is read
   * from what this server loaded, never from the request, so a visitor has no say in it.
   */
  const debugRendered = resolveDebugMode(
    debugAuthorized,
    // Named for this origin, port included — the browser writes it under the same name. See `debugCookieName`.
    readCookie(req.headers.cookie, debugCookieName(req.headers.host))
  );

  /**
   * The runs this render's server elements started, handed to a page that may debug them — and to no other.
   *
   * Same authorization as the panel itself: a page nobody authorized is told nothing about the flows behind it, not
   * even that they ran. A render carrying them is also one nobody else may be served from a cache: those runs are
   * this request's.
   */
  const actionRuns = debugAuthorized && req.ctx.actionRuns?.length ? req.ctx.actionRuns : undefined;

  // What the metering adapter decided for this page (see SSRAdapters.pageView). `firstViewCounted` is forced on
  // whatever the adapter returned: this render was already counted server-side, so the browser reporting the
  // same view again would double it.
  const { degrade, analytics } = req.ctx.meter ?? {};
  const clientAnalytics = analytics ? { ...analytics, firstViewCounted: true } : undefined;
  // The fact that the ACCOUNT is over its quota: only the server can state it, so a space cannot turn the notice off.
  const overQuota = degrade ? true : undefined;

  /**
   * The visitor's theme, from the cookie the SDK writes it to.
   *
   * This is the whole reason it is a cookie and not web storage: read here, the class goes on `<html>` in the
   * document the server sends, so the page arrives already painted in the right theme — no blocking script in the
   * head, and no first paint in the other theme for the SDK to correct four hundred milliseconds later.
   *
   * It travels to the browser too. The class alone would settle what the page LOOKS like, but a space can bind to
   * `{{ theme.resolved }}` or gate a rule on the scheme, and a client that started at `system` while the server
   * rendered `dark` would hydrate different markup and throw away the tree.
   *
   * Absent — a first visit — the space's own default applies (`style.theme.default`), painted by the server like a
   * choice would be. A default of `system` stamps nothing and the stylesheet's media queries answer, which is exactly
   * right for a space that did not pick.
   */
  const theme = themeFromCookies(req.headers.cookie) ?? declaredTheme(offlineData?.style);

  /**
   * The kept state the first paint depends on, from the cookie the SDK writes the space's `settings.paintedState` to.
   *
   * The theme's reasoning, for the space's own state: web storage is the browser's alone, so what a visitor chose — the
   * tool a toolbar shows, their name in an avatar — would reach the page only after hydration, and be swapped in over
   * the defaults the server drew. Read here, the server draws with it, and the page starts from the same values: it
   * travels as the SDK's `state`, the starting `runtime.state`, in the render and in the payload alike, or the client
   * would hydrate other markup. Only the keys the space declares, and only with `keepState` on.
   */
  const paintedState = schema?.settings.keepState
    ? paintedStateFor(req.headers.cookie, ssrPaintedCookieName(req.headers.host), paintedKeys(schema.settings))
    : undefined;

  /**
   * The two layers of the space's flags this server answers for. Its own (`config.flags`), asked per space when it
   * serves several; and the ones a tester forced from the dev tools, read from their cookie — only for a page allowed
   * to debug, or any visitor could switch on a feature still behind a flag. Both travel to the browser beside the
   * page, so it hydrates with the flags it was drawn with.
   */
  const { server: serverFlags, qa: forcedFlags } = flagOverrides;

  /**
   * The space travels beside the page rather than in it, fetched while the scripts are — see `spaceDocument`.
   *
   * Not for a draft, which no other process could produce when the fetch reaches it, and not for a deployment's own
   * template, which was written for the space inline; a page with no script needs no space at all.
   */
  const spaceDocumentPath =
    offlineData !== undefined &&
    offlineDataOverride === undefined &&
    config.templateFn === undefined &&
    config.ssrOnly !== true
      ? publishSpaceDocument(spaceId, environment, spaceDocument(offlineData))
      : undefined;

  const offlineDataStr = hydrationPayload(
    offlineData,
    {
      offlineMode: true,
      environment,
      renderMode: 'raw',
      server,
      sdkDevToolsStylePath,
      sdkIconsStylePath,
      ...(theme ? { theme } : {}),
      ...(paintedState ? { state: paintedState } : {}),
      ...(clientAnalytics ? { analytics: clientAnalytics } : {}),
      ...(overQuota ? { overQuota } : {}),
      ...(actionRuns ? { actionRuns } : {}),
      ...(serverFlags ? { serverFlags } : {}),
      ...(forcedFlags ? { forcedFlags } : {})
    },
    { apart: spaceDocumentPath !== undefined }
  );

  const pluginNames = req.ctx.spaceDeployment?.pluginNames ?? [];
  const pluginSources = req.ctx.spaceDeployment?.pluginSources;

  const pluginBaseNames = new Set(pluginNames.map(n => n.replace(/@[^@]*$/, '')));
  const dynamicNames: string[] = [];
  if (pluginSources) {
    for (const [pluginName, pluginSource] of Object.entries(pluginSources)) {
      const key = pluginManager.ensure(pluginName, pluginSource);
      if (!pluginBaseNames.has(pluginName)) {
        dynamicNames.push(key);
      }
    }
  }

  const autoLoad = config.autoLoadSchemaPlugins !== false;
  const externalNames = autoLoad
    ? await m('extPlugins', () =>
        registerExternalPlugins(
          pluginManager,
          offlineData,
          { allowPrivateHosts: config.allowPrivatePluginHosts === true },
          pluginBaseNames
        )
      )
    : [];

  const allPluginNames = [...pluginNames, ...dynamicNames, ...externalNames];
  const entries = allPluginNames.length > 0 ? await pluginManager.getEntries(allPluginNames) : [];

  const pluginComponents = await m('plugins', () => loadPluginComponents(entries, pluginManager.getComponents()));
  reportMissingPlugins(
    spaceId,
    schema,
    new Set([...Object.keys(pluginComponents), ...entries.map(entry => entry.keyName)])
  );

  const templateEntries = entries.length > 0 ? entries : req.ctx.spaceDeployment?.templateProps?.plugins;
  // `pluginComponents` is the exact set this render had a component for, so it is the only honest answer to
  // "was this plugin in the HTML" — it accounts for the ones served from a CDN and for the ones whose import
  // failed, without either of them having to declare it.
  /**
   * The plugins this page draws none of: the browser is sent what they declare, and loads one when a page that draws
   * it is opened. Their code is what the first paint waited on — a page of the website downloaded the builder's.
   *
   * Only one the server holds the component of can wait, since its declaration is read from it; a page matched to
   * nothing, which cannot say what it draws, waits for none.
   */
  const pageTypes =
    schema !== undefined && pageMatch !== undefined ? pageElementTypes(schema, pageMatch.pageId) : undefined;
  const deferredOf = (entry: PluginEntry): PluginDeclaration | undefined => {
    const plugin = pageTypes && entry.js ? (pluginComponents[entry.keyName] as SSRPlugin | undefined) : undefined;
    if (!plugin) {
      return undefined;
    }

    const declaration = declarationOf(plugin.component);

    return pluginTypesOf(entry.keyName, declaration).some(type => pageTypes?.has(type)) ? undefined : declaration;
  };
  const templatePlugins = templateEntries?.map(entry => {
    const deferred = deferredOf(entry);

    return { ...entry, ssr: entry.keyName in pluginComponents, ...(deferred ? { deferred } : {}) };
  });
  const vendorJs = (debugAuthorized ? '/sdk-assets/plitzi-sdk-dev-vendor.js' : '/sdk-assets/plitzi-sdk-vendor.js') + v;

  return {
    componentProps: {
      plugins: Object.keys(pluginComponents).length > 0 ? pluginComponents : undefined,
      offlineData,
      server,
      environment: req.ctx.spaceDeployment?.environment ?? environment,
      debugMode: debugRendered,
      sdkDevToolsStylePath,
      sdkIconsStylePath,
      overQuota,
      theme,
      ...(paintedState ? { state: paintedState } : {}),
      ...(serverFlags ? { serverFlags } : {}),
      ...(forcedFlags ? { forcedFlags } : {})
    },
    entries,
    templateParams: {
      title: DEFAULT_TITLE,
      jsPath: `/sdk-assets/plitzi-sdk.js${v}`,
      cssPath: `/sdk-assets/plitzi-sdk.css${v}`,
      iconsCssPath: sdkIconsStylePath,
      spaceDocumentPath,
      react: vendorJs,
      reactJsx: vendorJs,
      reactDom: vendorJs,
      reactDomClient: vendorJs,
      reactCompilerRuntime: vendorJs,
      /**
       * The class this document wears, straight onto `<html>` — see `theme` above.
       *
       * `system` and "never chose" both write nothing, and the silence is the mechanism: the stylesheet's
       * `prefers-color-scheme` queries are guarded on the absence of these classes, so stamping one would freeze the
       * page against the machine it is running on.
       */
      themeClass: theme && theme !== 'system' ? theme : undefined,
      /**
       * The space's own families, requested by the document itself.
       *
       * Ahead of the deployment's `templateProps` because a deployment cannot know them: they are a fact about the
       * space's style document, and a page whose text is laid out in a face the browser has not been asked for is
       * a page that renders in a fallback and then reflows.
       */
      fonts: fontsToHead(offlineData?.style.fonts ?? [], fontUrlResolver(config.fonts?.baseUrl)),
      ...req.ctx.spaceDeployment?.templateProps,
      // Applied last on purpose: the page speaks for itself. A deployment's `templateProps` is a space-wide
      // default and stays in charge of pages that declare nothing, which is what makes this safe to turn on for
      // deployments that already set a title of their own.
      ...pageSeo,
      plugins: templatePlugins,
      // The authorization, not what was drawn: see `debugAuthorized` above.
      debugMode: debugAuthorized,
      ssrOnly: config.ssrOnly === true,
      // The page reloads itself when the server says the space changed (`reloadPages`): only when asked for.
      devReload: config.devReload === true,
      offlineData: offlineDataStr
    },
    // Neither a render carrying this request's runs nor one drawn with a tester's forced flags is anybody else's page.
    cacheable: actionRuns === undefined && forcedFlags === undefined
  };
};
