import { renderToString } from 'react-dom/server';

import Component from './Component';
import { loadPluginComponents } from './loadPluginComponents';
import { registerExternalPlugins } from './registerExternalPlugins';
import { buildServerInfo } from '../helpers/buildServerInfo';
import { escapeJson } from '../helpers/escapeJson';

import type { PluginManager } from '../plugins/manager';
import type { SSRRequest, SSRServerConfig, SSRTemplateFn } from '../types';
import type { Environment } from '@plitzi/sdk-shared';

export const buildBody = async (
  req: SSRRequest,
  config: SSRServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager
): Promise<string> => {
  const offlineData = await config.adapters.getOfflineData(spaceId, environment, revision);
  const server = buildServerInfo(req, req.ctx);

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

  // Auto-register plugins defined inline in the deployment (e.g. downloaded from DB/CDN)
  // pluginNames contains base names; skip any plugin already covered there to avoid duplicates
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

  // Auto-register external plugins declared in the schema (offlineData.plugins)
  // Downloads JS/CSS from CDN once, caches to disk via PluginManager for subsequent requests
  const autoLoad = config.autoLoadSchemaPlugins !== false;
  const externalNames = autoLoad ? await registerExternalPlugins(pluginManager, offlineData) : [];
  const externalNamesFiltered = externalNames.filter(k => !pluginBaseNames.has(k.replace(/@[^@]*$/, '')));

  const allPluginNames = [...pluginNames, ...dynamicNames, ...externalNamesFiltered];
  const entries = allPluginNames.length > 0 ? await pluginManager.getEntries(allPluginNames) : [];

  // Load plugin React components for server-side rendering.
  // Results are cached in memory by filePath — subsequent requests skip the dynamic import().
  const pluginComponents = await loadPluginComponents(entries, pluginManager.getComponents());

  const html = renderToString(
    <Component
      plugins={Object.keys(pluginComponents).length > 0 ? pluginComponents : undefined}
      offlineData={offlineData}
      server={server}
      environment={req.ctx.spaceDeployment?.environment ?? environment}
      sdkEnvironment={config.sdkEnvironment ?? 'production'}
    />
  ).trim();

  const templatePlugins = entries.length > 0 ? entries : req.ctx.spaceDeployment?.templateProps?.plugins;

  return renderFn({
    title: 'Plitzi App',
    jsPath: '/sdk-assets/plitzi-sdk.js',
    cssPath: '/sdk-assets/plitzi-sdk.css',
    react: '/sdk-assets/plitzi-sdk-vendor.js',
    reactJsx: '/sdk-assets/plitzi-sdk-vendor.js',
    reactDom: '/sdk-assets/plitzi-sdk-vendor.js',
    reactDomClient: '/sdk-assets/plitzi-sdk-vendor.js',
    ...req.ctx.spaceDeployment?.templateProps,
    plugins: templatePlugins,
    ssrOnly: config.ssrOnly === true,
    html,
    offlineData: offlineDataStr
  });
};
