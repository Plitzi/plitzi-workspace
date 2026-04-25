import { renderToString } from 'react-dom/server';

import Component from './Component';
import { prepareRender } from './prepareRender';

import type { TtlCache } from '../helpers/cache';
import type { RequestMetrics } from '../helpers/metrics';
import type { PluginManager } from '../plugins/manager';
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

  const html = await (metrics
    ? metrics.measure('react', () => renderToString(<Component {...prep.componentProps} />).trim())
    : Promise.resolve(renderToString(<Component {...prep.componentProps} />).trim()));

  const t = metrics ? performance.now() : 0;
  const body = renderFn({ ...prep.templateParams, html });
  metrics?.record('template', Math.round(performance.now() - t));

  return body;
};
