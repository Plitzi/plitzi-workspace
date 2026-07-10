import { serveStatic } from '../../staticFiles';

import type { SSRContext, Stage } from '../types';
import type { SSRRequest } from '@plitzi/sdk-shared';

// Serves compiled plugin bundles under the plugin manager's URL prefix, preparing the plugin on demand.
export const pluginAssetsStage: Stage<SSRContext> = async ctx => {
  const { pluginManager, req, res } = ctx;
  if (!req.path.startsWith(pluginManager.urlPrefix + '/')) {
    return false;
  }

  const relative = req.path.slice(pluginManager.urlPrefix.length);
  const pluginName = relative.split('/')[1];
  if (pluginName && pluginManager.hasPlugin(pluginName)) {
    await pluginManager.prepare(pluginName);
    const strippedReq: SSRRequest = { ...req, path: relative };
    if (serveStatic(strippedReq, res, pluginManager.outputDir)) {
      return true;
    }
  }

  res.setStatus(404);
  res.send('Not found');

  return true;
};
