import { handleIconFace } from '../../modules/icons/handler';
import { ICONS_PATH } from '../../modules/icons/spaceIcons';
import { resolveSdkAssetsDir } from '../sdkAssets';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';

// A space's icon faces, linked by its pages' heads. Beside its stylesheet, after the auth middleware chain.
export const iconFacesStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  if (req.method !== 'GET' || !req.path.startsWith(ICONS_PATH)) {
    return false;
  }

  ctx.operation = 'icons';
  await handleIconFace(req, ctx.res, config, resolveSdkAssetsDir(), ctx.caches.offlineData);

  return true;
};
