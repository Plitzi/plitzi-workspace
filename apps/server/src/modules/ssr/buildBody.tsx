import { renderToString } from 'react-dom/server';

import Component from './Component';
import { prepareRender } from './prepareRender';

import type { TtlCache } from '../../helpers/cache';
import type { RequestMetrics } from '../../helpers/metrics';
import type { PluginManager } from '../../plugins/manager';
import type { Environment, SSRRequest, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';

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
  const prep = await prepareRender(
    req,
    config,
    spaceId,
    environment,
    revision,
    pluginManager,
    offlineDataCache,
    metrics
  );

  const reactStart = metrics ? performance.now() : 0;
  const html = renderToString(<Component {...prep.componentProps} />).trim();
  metrics?.record('react', Math.round(performance.now() - reactStart));

  const templateStart = metrics ? performance.now() : 0;
  const body = renderFn({ ...prep.templateParams, html });
  metrics?.record('template', Math.round(performance.now() - templateStart));

  return body;
};
