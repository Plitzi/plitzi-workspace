import { renderToString } from 'react-dom/server';

import { buildOfflineDataCacheKey } from '../helpers/cache';
import { buildServerInfo } from '../helpers/buildServerInfo';
import { escapeJson } from '../helpers/escapeJson';
import Component from './Component';
import { loadPluginComponents } from './loadPluginComponents';
import { registerExternalPlugins } from './registerExternalPlugins';

import type { TtlCache } from '../helpers/cache';
import type { RequestMetrics } from '../helpers/metrics';
import type { PluginManager } from '../plugins/manager';
import type { Environment, OfflineDataRaw, SSRRequest, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';

export const buildBody = async (
  req: SSRRequest,
  config: SSRServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  offlineDataCache?: TtlCache<string>,
  metrics?: RequestMetrics
): Promise<string> => {
  const m = <T,>(name: string, fn: () => T | Promise<T>): Promise<T> =>
    metrics ? metrics.measure(name, fn) : Promise.resolve(fn()) as Promise<T>;

  // offlineData is cached per spaceId|env|revision (skip main — schema changes frequently there).
  const offlineCacheKey = environment !== 'main' ? buildOfflineDataCacheKey(spaceId, environment, revision) : undefined;
  const cachedOfflineStr = offlineCacheKey ? offlineDataCache?.get(offlineCacheKey) : undefined;

  const [offlineData, server] = await Promise.all([
    cachedOfflineStr
      ? (JSON.parse(cachedOfflineStr) as OfflineDataRaw | undefined)
      : m('schema', () => config.adapters.getOfflineData(spaceId, environment, revision)),
    m('rsc', () => buildServerInfo(req, config))
  ]);

  if (!cachedOfflineStr && offlineCacheKey && offlineData !== undefined) {
    offlineDataCache?.set(offlineCacheKey, JSON.stringify(offlineData));
  }

  const offlineDataStr = escapeJson(
    JSON.stringify({
      offlineData,
      offlineMode: true,
      environment,
      renderMode: 'raw',
      server,
      sdkEnvironment: config.sdkEnvironment ?? 'production'
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

  const html = await m('react', () =>
    renderToString(
      <Component
        plugins={Object.keys(pluginComponents).length > 0 ? pluginComponents : undefined}
        offlineData={offlineData}
        server={server}
        environment={req.ctx.spaceDeployment?.environment ?? environment}
        sdkEnvironment={config.sdkEnvironment ?? 'production'}
      />
    ).trim()
  );

  const templatePlugins = entries.length > 0 ? entries : req.ctx.spaceDeployment?.templateProps?.plugins;
  const v = config.assetVersion ? `?v=${config.assetVersion}` : '';
  const vendorJs = (config.devMode ? '/sdk-assets/plitzi-sdk-dev-vendor.js' : '/sdk-assets/plitzi-sdk-vendor.js') + v;

  return renderFn({
    title: 'Plitzi App',
    jsPath: `/sdk-assets/plitzi-sdk.js${v}`,
    cssPath: `/sdk-assets/plitzi-sdk.css${v}`,
    react: vendorJs,
    reactJsx: vendorJs,
    reactDom: vendorJs,
    reactDomClient: vendorJs,
    ...req.ctx.spaceDeployment?.templateProps,
    plugins: templatePlugins,
    debugMode: config.devMode,
    ssrOnly: config.ssrOnly === true,
    html,
    offlineData: offlineDataStr
  });
};
