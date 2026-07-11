import { createPreview } from '../../modules/ssr/preview';
import { readRawBody } from '../requestParser';

import type { PreviewRequestBody } from '../../modules/mcp/previewTypes';
import type { SSRContext, Stage } from '../http/types';

const PREVIEW_PATH_DEFAULT = '/__preview';

const json = (ctx: SSRContext, status: number, payload: unknown): true => {
  ctx.res.setHeader('Content-Type', 'application/json');
  ctx.res.setStatus(status);
  ctx.res.send(JSON.stringify(payload));

  return true;
};

// Internal endpoint that mints a draft-preview: applies unsaved operations to a clone, renders the draft to
// HTML, and stashes it under a one-shot token for a follow-up screenshot. Guarded by a shared secret and only
// mounted when config.preview.enabled — off by default. Lives in the SSR pipeline because it needs the render
// singletons (renderFn / pluginManager / caches) that only an SSR server constructs.
export const previewStage: Stage<SSRContext> = async ctx => {
  const preview = ctx.config.preview;
  const path = preview?.path ?? PREVIEW_PATH_DEFAULT;
  if (!preview?.enabled || ctx.req.method !== 'POST' || ctx.req.path !== path) {
    return false;
  }

  if (preview.secret && ctx.req.headers['x-preview-secret'] !== preview.secret) {
    return json(ctx, 403, { error: 'FORBIDDEN', message: 'Invalid or missing preview secret.' });
  }

  ctx.req.body = await readRawBody(ctx.raw);
  let body: PreviewRequestBody;
  try {
    body = JSON.parse(ctx.req.body || '{}') as PreviewRequestBody;
  } catch {
    return json(ctx, 400, { error: 'BAD_REQUEST', message: 'Request body must be JSON.' });
  }

  if (typeof body.spaceId !== 'number') {
    return json(ctx, 400, { error: 'BAD_REQUEST', message: 'spaceId (number) is required.' });
  }

  const result = await createPreview(body, ctx.config, ctx.renderFn, ctx.pluginManager, ctx.caches);

  return json(ctx, result.ok ? 200 : 422, result);
};
