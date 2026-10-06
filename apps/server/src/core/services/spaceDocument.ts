import { handleSpaceDocument, SPACE_DOCUMENT_PATH } from '../../modules/ssr/spaceDocument';

import type { SSRContext, Stage } from '../http/types';

// The space a page fetches beside it. After the auth middleware chain: whoever may not open a page may not read this.
export const spaceDocumentStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  if (req.method !== 'GET' || !req.path.startsWith(SPACE_DOCUMENT_PATH)) {
    return false;
  }

  ctx.operation = 'space';
  await handleSpaceDocument(req, ctx.res, config, ctx.caches.offlineData);

  return true;
};
