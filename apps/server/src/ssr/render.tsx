import { renderToString } from 'react-dom/server';

import Component from './Component';
import { renderTemplate } from './template';
import { buildServerInfo } from '../helpers/buildServerInfo';

import type { SSRRequest, SSRResponseHelpers, SSRContext, SSRServerConfig } from '../types';
import type { Environment } from '@plitzi/sdk-shared';

const escapeJson = (str: string): string =>
  str
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/**
 * Perform SSR for a single request.
 *
 * Reads space/environment from `ctx.spaceDeployment` (populated by the
 * spaceDeployment middleware) and calls `config.adapters.getOfflineData` to
 * fetch the space snapshot.
 */
export const renderSSR = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  ctx: SSRContext,
  config: SSRServerConfig
): Promise<void> => {
  const {
    environment = 'main',
    spaceId = 1,
    revision = 0
  } = ctx.spaceDeployment as Exclude<typeof ctx.spaceDeployment, undefined>;

  const offlineData = await config.adapters.getOfflineData(spaceId as number, environment as string, revision);
  const server = buildServerInfo(req);

  const html = renderToString(
    <Component
      offlineData={offlineData}
      server={server}
      environment={environment as Environment}
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

  const body = renderTemplate({
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

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(body);
};
