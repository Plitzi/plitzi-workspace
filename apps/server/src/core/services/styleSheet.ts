import { STYLE_SHEET_PATH } from '@plitzi/sdk-shared/style';

import { handleStyleSheet } from '../../modules/ssr/styleSheet';

import type { SSRContext, Stage } from '../http/types';

// The stylesheet a page links. After the auth middleware chain, beside the space document it is part of.
export const styleSheetStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  if (req.method !== 'GET' || !req.path.startsWith(STYLE_SHEET_PATH)) {
    return false;
  }

  ctx.operation = 'style';
  await handleStyleSheet(req, ctx.res, config, ctx.caches.offlineData);

  return true;
};
