import {
  answerCurrentSpacePreflight,
  CURRENT_SPACE_PATH,
  handleCurrentSpace,
  handleSpaceDocument,
  SPACE_DOCUMENT_PATH
} from '../../modules/ssr/spaceDocument';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';

// The space a page fetches beside it, and the space as it is now for a page that renders it itself. After the auth
// middleware chain: whoever may not open a page may not read either.
export const spaceDocumentStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  if (req.path === CURRENT_SPACE_PATH) {
    if (req.method === 'OPTIONS') {
      answerCurrentSpacePreflight(req, ctx.res);

      return true;
    }

    if (req.method !== 'GET') {
      return false;
    }

    ctx.operation = 'space';
    await handleCurrentSpace(req, ctx.res, config, ctx.caches.offlineData);

    return true;
  }

  if (req.method !== 'GET' || !req.path.startsWith(SPACE_DOCUMENT_PATH)) {
    return false;
  }

  ctx.operation = 'space';
  await handleSpaceDocument(req, ctx.res, config, ctx.caches.offlineData);

  return true;
};
