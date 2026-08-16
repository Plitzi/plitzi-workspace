import { hasServerElements } from '@plitzi/sdk-shared/schema/serverElements';

import { loadPluginComponents } from './loadPluginComponents';
import { registerExternalPlugins } from './registerExternalPlugins';
import { sdkAssetVersion } from '../../core/sdkAssets';
import { resolveRscEndpoint } from '../../core/services/resolve';
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
  const pageMatch = rscPath && schema ? matchRscPage(schema, req.path, req.ctx.user) : undefined;
  const hasTargets = !!schema && !!pageMatch && hasServerElements(schema, pageMatch.pageId);
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

  const server = buildServerInfo(req, config, { rscPath, rscData });

  if (offlineDataOverride === undefined && !cachedOfflineStr && offlineCacheKey && offlineData !== undefined) {
    offlineDataCache?.set(offlineCacheKey, JSON.stringify(offlineData));
  }

  // Falls back to the bundle's own mtime, so the cache-buster is right without anybody supplying one.
  const version = config.assetVersion ?? sdkAssetVersion();
  const v = version ? `?v=${version}` : '';
  const sdkDevToolsStylePath = `/sdk-assets/plitzi-sdk-devtools.css${v}`;

  const debugMode = resolveDebugMode(
    config.debugMode ?? config.devMode,
    readCookie(req.headers.cookie, 'plitzi_debug')
  );

  // What the metering adapter decided for this page (see SSRAdapters.pageView). `firstViewCounted` is forced on
  // whatever the adapter returned: this render was already counted server-side, so the browser reporting the
  // same view again would double it. Degrading pins the badge on rather than merely defaulting it, so a space
  // over its quota cannot turn it off from its own settings.
  const { degrade, analytics } = req.ctx.meter ?? {};
  const clientAnalytics = analytics ? { ...analytics, firstViewCounted: true } : undefined;
  const branding = degrade ? true : undefined;

  const offlineDataStr = escapeJson(
    JSON.stringify({
      offlineData,
      offlineMode: true,
      environment,
      renderMode: 'raw',
      server,
      sdkDevToolsStylePath,
      ...(clientAnalytics ? { analytics: clientAnalytics } : {}),
      ...(branding ? { branding } : {})
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

  const templatePlugins = entries.length > 0 ? entries : req.ctx.spaceDeployment?.templateProps?.plugins;
  const vendorJs = (config.devMode ? '/sdk-assets/plitzi-sdk-dev-vendor.js' : '/sdk-assets/plitzi-sdk-vendor.js') + v;

  return {
    componentProps: {
      plugins: Object.keys(pluginComponents).length > 0 ? pluginComponents : undefined,
      offlineData,
      server,
      environment: req.ctx.spaceDeployment?.environment ?? environment,
      debugMode,
      sdkDevToolsStylePath,
      branding
    },
    entries,
    templateParams: {
      title: 'Plitzi App',
      jsPath: `/sdk-assets/plitzi-sdk.js${v}`,
      cssPath: `/sdk-assets/plitzi-sdk.css${v}`,
      react: vendorJs,
      reactJsx: vendorJs,
      reactDom: vendorJs,
      reactDomClient: vendorJs,
      reactCompilerRuntime: vendorJs,
      ...req.ctx.spaceDeployment?.templateProps,
      plugins: templatePlugins,
      debugMode,
      ssrOnly: config.ssrOnly === true,
      offlineData: offlineDataStr
    }
  };
};
