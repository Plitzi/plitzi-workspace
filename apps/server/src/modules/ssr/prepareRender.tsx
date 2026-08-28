import { debugCookieName } from '@plitzi/sdk-shared/devTools';
import { hasServerElements } from '@plitzi/sdk-shared/schema/serverElements';

import { loadPluginComponents } from './loadPluginComponents';
import { registerExternalPlugins } from './registerExternalPlugins';
import { resolvePageSeo } from './resolvePageSeo';
import { PREVIEW_TOKEN_PARAM } from '../../core/previewToken';
import { sdkAssetVersion } from '../../core/sdkAssets';
import { resolveActionEndpoint, resolveRscEndpoint } from '../../core/services/resolve';
import { buildServerInfo } from '../../helpers/buildServerInfo';
import { buildOfflineDataCacheKey } from '../../helpers/cache';
import { escapeJson } from '../../helpers/escapeJson';
import { createOfflineDataLoader } from '../../helpers/offlineDataLoader';
import { readCookie } from '../../helpers/readCookie';
import { resolveDebugMode } from '../../helpers/resolveDebugMode';
import { matchRscPage } from '../rsc/matchRscPage';

import type { ComponentProps } from './Component';
import type { TtlCache } from '../../helpers/cache';
import type { RequestMetrics } from '../../helpers/metrics';
import type { PluginManager } from '../../plugins/manager';
import type {
  Environment,
  OfflineDataRaw,
  PluginEntry,
  SSRPageServerConfig,
  SSRRequest,
  SSRTemplateProps
} from '@plitzi/sdk-shared';

/** Last resort only: used for a page that declares no SEO title and a deployment that supplies none either. */
const DEFAULT_TITLE = 'Plitzi App';

export type RenderPrep = {
  componentProps: ComponentProps;
  entries: PluginEntry[];
  templateParams: SSRTemplateProps & { offlineData: string };
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

  const offlineCacheKey = environment !== 'main' ? buildOfflineDataCacheKey(spaceId, environment, revision) : undefined;
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
  const hasTargets = rscEnabled && pageMatch !== undefined && hasServerElements(schema, pageMatch.pageId);
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
            loadOfflineData
          })
        )
      : rscPath
        ? { serverData: {} }
        : undefined;

  const pageSeo = resolvePageSeo(schema, pageMatch?.pageId);

  const server = buildServerInfo(req, config, { rscPath, rscData, actionPath: resolveActionEndpoint(config) });

  if (offlineDataOverride === undefined && !cachedOfflineStr && offlineCacheKey && offlineData !== undefined) {
    offlineDataCache?.set(offlineCacheKey, JSON.stringify(offlineData));
  }

  // Falls back to the bundle's own mtime, so the cache-buster is right without anybody supplying one.
  const version = config.assetVersion ?? sdkAssetVersion();
  const v = version ? `?v=${version}` : '';
  const sdkDevToolsStylePath = `/sdk-assets/plitzi-sdk-devtools.css${v}`;

  // A `__pt` render exists to be looked at as a picture — a thumbnail, the agent's screenshot, the builder's
  // preview pane. Nobody is at that keyboard to dismiss the dev-tools badge, and it would be baked into the
  // capture, so debugging is off for it however the deployment and the cookie are set.
  const isPreviewRender = Boolean(req.query[PREVIEW_TOKEN_PARAM]);
  const debugMode =
    !isPreviewRender &&
    resolveDebugMode(
      config.debugMode ?? config.devMode,
      // Named for this origin, port included — the browser writes it under the same name. See `debugCookieName`.
      readCookie(req.headers.cookie, debugCookieName(req.headers.host))
    );

  // What the metering adapter decided for this page (see SSRAdapters.pageView). `firstViewCounted` is forced on
  // whatever the adapter returned: this render was already counted server-side, so the browser reporting the
  // same view again would double it. Degrading pins the badge on rather than merely defaulting it, so a space
  // over its quota cannot turn it off from its own settings.
  const { degrade, analytics } = req.ctx.meter ?? {};
  const clientAnalytics = analytics ? { ...analytics, firstViewCounted: true } : undefined;
  const branding = degrade ? true : undefined;
  // The same state, said out loud. `branding` is forced on by it but is also on for every ordinary free space, so
  // it cannot be what a notice reads — this is the fact that the ACCOUNT is over, and only the server can state it.
  const overQuota = degrade ? true : undefined;

  const offlineDataStr = escapeJson(
    JSON.stringify({
      offlineData,
      offlineMode: true,
      environment,
      renderMode: 'raw',
      server,
      sdkDevToolsStylePath,
      ...(clientAnalytics ? { analytics: clientAnalytics } : {}),
      ...(branding ? { branding } : {}),
      ...(overQuota ? { overQuota } : {})
    })
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
    ? await m('extPlugins', () => registerExternalPlugins(pluginManager, offlineData))
    : [];
  const externalNamesFiltered = externalNames.filter(k => !pluginBaseNames.has(k.replace(/@[^@]*$/, '')));

  const allPluginNames = [...pluginNames, ...dynamicNames, ...externalNamesFiltered];
  const entries = allPluginNames.length > 0 ? await pluginManager.getEntries(allPluginNames) : [];

  const pluginComponents = await m('plugins', () => loadPluginComponents(entries, pluginManager.getComponents()));

  const templateEntries = entries.length > 0 ? entries : req.ctx.spaceDeployment?.templateProps?.plugins;
  // `pluginComponents` is the exact set this render had a component for, so it is the only honest answer to
  // "was this plugin in the HTML" — it accounts for the ones served from a CDN and for the ones whose import
  // failed, without either of them having to declare it.
  const templatePlugins = templateEntries?.map(entry => ({ ...entry, ssr: entry.keyName in pluginComponents }));
  const vendorJs = (config.devMode ? '/sdk-assets/plitzi-sdk-dev-vendor.js' : '/sdk-assets/plitzi-sdk-vendor.js') + v;

  return {
    componentProps: {
      plugins: Object.keys(pluginComponents).length > 0 ? pluginComponents : undefined,
      offlineData,
      server,
      environment: req.ctx.spaceDeployment?.environment ?? environment,
      debugMode,
      sdkDevToolsStylePath,
      branding,
      overQuota
    },
    entries,
    templateParams: {
      title: DEFAULT_TITLE,
      jsPath: `/sdk-assets/plitzi-sdk.js${v}`,
      cssPath: `/sdk-assets/plitzi-sdk.css${v}`,
      react: vendorJs,
      reactJsx: vendorJs,
      reactDom: vendorJs,
      reactDomClient: vendorJs,
      reactCompilerRuntime: vendorJs,
      ...req.ctx.spaceDeployment?.templateProps,
      // Applied last on purpose: the page speaks for itself. A deployment's `templateProps` is a space-wide
      // default and stays in charge of pages that declare nothing, which is what makes this safe to turn on for
      // deployments that already set a title of their own.
      ...pageSeo,
      plugins: templatePlugins,
      debugMode,
      ssrOnly: config.ssrOnly === true,
      offlineData: offlineDataStr
    }
  };
};
