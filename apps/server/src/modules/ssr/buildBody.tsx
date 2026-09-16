import { renderToString } from 'react-dom/server';

import Component from './Component';
import { prepareRender } from './prepareRender';

import type { TtlCache } from '../../helpers/cache';
import type { RequestMetrics } from '../../helpers/metrics';
import type { PluginManager } from '../../plugins/manager';
import type {
  Environment,
  OfflineDataRaw,
  SSRPageServerConfig,
  SSRRenderResult,
  SSRRequest,
  SSRTemplateFn
} from '@plitzi/sdk-shared';

/** `cacheable` is false for a body that must not be served to anybody else: it carries this request's own runs. */
export type BuildBodyResult = { body?: string; result: SSRRenderResult; cacheable: boolean };

export const buildBody = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  offlineDataCache?: TtlCache<string>,
  metrics?: RequestMetrics,
  offlineDataOverride?: OfflineDataRaw
): Promise<BuildBodyResult> => {
  const prep = await prepareRender(
    req,
    config,
    spaceId,
    environment,
    revision,
    pluginManager,
    offlineDataCache,
    metrics,
    offlineDataOverride
  );

  const result: SSRRenderResult = {};

  const reactStart = metrics ? performance.now() : 0;
  const html = renderToString(<Component {...prep.componentProps} ssrResult={result} />).trim();
  metrics?.record('react', Math.round(performance.now() - reactStart));

  if (result.redirect !== undefined) {
    return { result, cacheable: prep.cacheable };
  }

  const templateStart = metrics ? performance.now() : 0;
  const body = renderFn({ ...prep.templateParams, html });
  metrics?.record('template', Math.round(performance.now() - templateStart));

  return { body, result, cacheable: prep.cacheable };
};
