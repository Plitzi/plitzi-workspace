import { loadPluginComponents } from './loadPluginComponents';
import { registerExternalPlugins } from './registerExternalPlugins';
import { buildServerInfo } from '../../helpers/buildServerInfo';
import { buildOfflineDataCacheKey } from '../../helpers/cache';
import { escapeJson } from '../../helpers/escapeJson';
import { readCookie } from '../../helpers/readCookie';

import type { ComponentProps } from './Component';
import type { TtlCache } from '../../helpers/cache';
import type { RequestMetrics } from '../../helpers/metrics';
import type { PluginManager } from '../../plugins/manager';
import type {
  Environment,
  OfflineDataRaw,
  PluginEntry,
  SSRRequest,
  SSRServerConfig,
  SSRTemplateProps
} from '@plitzi/sdk-shared';

export type RenderPrep = {
  componentProps: ComponentProps;
  entries: PluginEntry[];
  templateParams: SSRTemplateProps & { offlineData: string };
};

export const prepareRender = async (
  req: SSRRequest,
  config: SSRServerConfig,
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

  const [offlineData, server] = await Promise.all([
    offlineDataOverride !== undefined
      ? Promise.resolve<OfflineDataRaw | undefined>(offlineDataOverride)
      : cachedOfflineStr
        ? (JSON.parse(cachedOfflineStr) as OfflineDataRaw | undefined)
        : m('schema', () => config.adapters.getOfflineData(spaceId, environment, revision)),
    m('rsc', () => buildServerInfo(req, config))
  ]);

  if (offlineDataOverride === undefined && !cachedOfflineStr && offlineCacheKey && offlineData !== undefined) {
    offlineDataCache?.set(offlineCacheKey, JSON.stringify(offlineData));
  }

  const v = config.assetVersion ? `?v=${config.assetVersion}` : '';
  const sdkDevToolsStylePath = `/sdk-assets/plitzi-sdk-devtools.css${v}`;

  // debugMode is owned by the client (shift+F12) and persisted in the 'plitzi_debug' cookie so this SSR
  // render matches what the client will hydrate with. Falls back to devMode when the cookie is unset.
  const debugCookie = readCookie(req.headers.cookie, 'plitzi_debug');
  const debugMode = debugCookie === undefined ? config.devMode : debugCookie === 'true';

  const offlineDataStr = escapeJson(
    JSON.stringify({ offlineData, offlineMode: true, environment, renderMode: 'raw', server, sdkDevToolsStylePath })
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
      sdkDevToolsStylePath
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
