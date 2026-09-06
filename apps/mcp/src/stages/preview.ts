import { readRawBody } from '@plitzi/sdk-server/kernel';

import { createPreview } from '../preview/createPreview';

import type { PreviewRequestBody } from '../modules/mcp/types';
import type { SSRContext, Stage } from '@plitzi/sdk-server/kernel';

const PREVIEW_PATH_DEFAULT = '/__preview';

const json = (ctx: SSRContext, status: number, payload: unknown): true => {
  ctx.res.setHeader('Content-Type', 'application/json');
  ctx.res.setStatus(status);
  ctx.res.send(JSON.stringify(payload));

  return true;
};

// Internal endpoint for draft previews. POST applies unsaved operations to a clone, renders the draft to HTML and
// stashes it under a token — one-shot for a follow-up screenshot, reusable when the caller asked for a session
// somebody can iterate against; DELETE ends one. Guarded by a shared secret and only mounted when
// config.preview.enabled — off by default. Lives in the SSR pipeline because it needs the render
// singletons (renderFn / pluginManager / caches) that only an SSR server constructs.
export const previewStage: Stage<SSRContext> = async ctx => {
  const preview = ctx.config.preview;
  const path = preview?.path ?? PREVIEW_PATH_DEFAULT;
  // `POST <path>/end` rather than a DELETE on the path itself: the mint endpoint already proves how a POST travels
  // through this pipeline, and ending a session is not the request to discover that another method does not.
  const ending = ctx.req.path === `${path}/end`;
  if (!preview?.enabled || ctx.req.method !== 'POST' || (ctx.req.path !== path && !ending)) {
    return false;
  }

  if (preview.secret && ctx.req.headers['x-preview-secret'] !== preview.secret) {
    return json(ctx, 403, { error: 'FORBIDDEN', message: 'Invalid or missing preview secret.' });
  }

  ctx.req.body = await readRawBody(ctx.raw);

  /**
   * Ending a draft session, which is the half that makes one safe to offer.
   *
   * Without it a session is only ever ended by its own expiry, so "stop previewing" would leave a working URL behind
   * for as long as the TTL says — and the person who asked to stop is precisely the one who has reason to think it
   * no longer resolves.
   *
   * A token the store does not have answers 200 all the same: the caller asked for it to be gone, and it is.
   */
  if (ending) {
    const { token } = JSON.parse(ctx.req.body || '{}') as { token?: string };
    if (typeof token !== 'string' || !token) {
      return json(ctx, 400, { error: 'BAD_REQUEST', message: 'token (string) is required.' });
    }

    await ctx.config.draftStore?.drop(token);

    return json(ctx, 200, { ok: true });
  }
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
