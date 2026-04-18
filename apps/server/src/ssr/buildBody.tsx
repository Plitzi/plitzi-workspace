import { renderToString } from 'react-dom/server';

import Component from './Component';
import { renderTemplate } from './template';
import { buildServerInfo } from '../helpers/buildServerInfo';
import { escapeJson } from '../helpers/escapeJson';

import type { SSRRequest, SSRContext, SSRServerConfig } from '../types';
import type { Environment } from '@plitzi/sdk-shared';

export const buildBody = async (
  req: SSRRequest,
  ctx: SSRContext,
  config: SSRServerConfig,
  spaceId: number,
  environment: string,
  revision: number
): Promise<string> => {
  const offlineData = await config.adapters.getOfflineData(spaceId, environment, revision);
  const server = buildServerInfo(req);

  const html = renderToString(
    <Component
      offlineData={offlineData}
      server={server}
      environment={(ctx.spaceDeployment?.environment ?? environment) as Environment}
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

  return renderTemplate({
    title: 'Plitzi App',
    html,
    offlineData: offlineDataStr,
    jsPath: '/sdk-assets/plitzi-sdk.js',
    cssPath: '/sdk-assets/plitzi-sdk.css',
    builderJsPath: '/builder-assets/plitzi-builder.js',
    builderCssPath: '/builder-assets/plitzi-builder.css',
    react: `${reactBase}${devSuffix}`,
    reactJsx: `${reactBase}/jsx-runtime${devSuffix}`,
    reactDom: `${reactDomBase}${devSuffix}`,
    reactDomClient: `${reactDomBase}/client${devSuffix}`
  });
};
