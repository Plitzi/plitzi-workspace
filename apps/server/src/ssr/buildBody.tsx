import { renderToString } from 'react-dom/server';

import Component from './Component';
import { registerExternalPlugins } from './registerExternalPlugins';
import { buildServerInfo } from '../helpers/buildServerInfo';
import { escapeJson } from '../helpers/escapeJson';

import type { PluginManager } from '../plugins/manager';
import type { SSRRequest, SSRContext, SSRServerConfig, SSRTemplateFn } from '../types';
import type { Environment } from '@plitzi/sdk-shared';

export const buildBody = async (
  req: SSRRequest,
  ctx: SSRContext,
  config: SSRServerConfig,
  spaceId: number,
  environment: string,
  revision: number,
  renderFn: SSRTemplateFn,
  pluginManager?: PluginManager
): Promise<string> => {
  const [offlineData, user] = await Promise.all([
    config.adapters.getOfflineData(spaceId, environment, revision),
    config.adapters.getUser?.(req)
  ]);

  const resolvedCtx: SSRContext = { ...ctx, user };
  const server = buildServerInfo(req, resolvedCtx);

  const html = renderToString(
    <Component
      offlineData={offlineData}
      server={server}
      environment={(resolvedCtx.spaceDeployment?.environment ?? environment) as Environment}
      sdkEnvironment={config.sdkEnvironment ?? 'production'}
    />
  ).trim();

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

  const devMode = config.devMode ?? process.env.NODE_ENV !== 'production';
  const reactVersion = config.reactVersion ?? '19';
  const reactBase = `https://esm.sh/react@${reactVersion}`;
  const reactDomBase = `https://esm.sh/react-dom@${reactVersion}`;
  const devSuffix = devMode ? '?dev' : '';

  const pluginNames = resolvedCtx.spaceDeployment?.pluginNames ?? [];
  const pluginSources = resolvedCtx.spaceDeployment?.pluginSources;

  // Auto-register plugins defined inline in the deployment (e.g. downloaded from DB/CDN)
  // pluginNames contains base names; skip any plugin already covered there to avoid duplicates
  const pluginBaseNames = new Set(pluginNames.map(n => n.replace(/@[^@]*$/, '')));
  const dynamicNames: string[] = [];
  if (pluginManager && pluginSources) {
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
  const externalNames = autoLoad && pluginManager ? await registerExternalPlugins(pluginManager, offlineData) : [];
  const externalNamesFiltered = externalNames.filter(k => !pluginBaseNames.has(k.replace(/@[^@]*$/, '')));

  const allPluginNames = [...pluginNames, ...dynamicNames, ...externalNamesFiltered];
  const plugins =
    pluginManager && allPluginNames.length > 0 ? await pluginManager.getEntries(allPluginNames) : undefined;

  return renderFn({
    title: 'Plitzi App',
    jsPath: '/sdk-assets/plitzi-sdk.js',
    cssPath: '/sdk-assets/plitzi-sdk.css',
    react: `${reactBase}${devSuffix}`,
    reactJsx: `${reactBase}/jsx-runtime${devSuffix}`,
    reactDom: `${reactDomBase}${devSuffix}`,
    reactDomClient: `${reactDomBase}/client${devSuffix}`,
    ...resolvedCtx.spaceDeployment?.templateProps,
    plugins: plugins ?? resolvedCtx.spaceDeployment?.templateProps?.plugins,
    ssrOnly: config.ssrOnly === true,
    html,
    offlineData: offlineDataStr
  });
};
