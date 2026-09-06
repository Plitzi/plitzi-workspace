import { randomUUID } from 'node:crypto';

import { buildBody } from '@plitzi/sdk-server/ssr';

import { cloneSpace, computeVersion, findPageByRef, getPageElements } from '../modules/mcp/helpers';
import { applyOperations, validateOperations } from '../modules/mcp/tools';

import type { PreviewRequestBody, PreviewResult } from '../modules/mcp/types';
import type { PluginManager, ServerCaches } from '@plitzi/sdk-server/ssr';
import type { Environment, Schema, SSRPageServerConfig, SSRRequest, SSRTemplateFn } from '@plitzi/sdk-shared';

const resolvePagePath = (schema: Schema, pageRef?: string): string => {
  const pages = getPageElements(schema);
  const page = pageRef ? findPageByRef(schema, pageRef) : (pages.find(p => p.attributes.default) ?? pages[0]);
  const slug = page && typeof page.attributes.slug === 'string' ? page.attributes.slug : '';

  return slug.startsWith('/') ? slug : `/${slug}`;
};

const syntheticRequest = (pagePath: string): SSRRequest => ({
  method: 'GET',
  path: pagePath,
  search: '',
  url: pagePath,
  hostname: 'localhost',
  protocol: 'https',
  headers: {},
  query: {},
  ctx: {}
});

/** Build a preview of a page: apply any unsaved `operations` to a clone (never persisted), render the resulting
 *  draft to full HTML via the SSR pipeline, and stash the draft under a token so a browser can fetch the exact same
 *  render at `?__pt=<token>`. With no operations it previews persisted state.
 *
 *  The token is one-shot unless `mode: 'session'` asks for one somebody can iterate against — see `mode`.
 *
 *  Renders through the host page server's own singletons, which is why it takes them as arguments rather than
 *  building any: this runs as a stage INSIDE an SSR server, not in the MCP process that calls it over HTTP. */
export const createPreview = async (
  body: PreviewRequestBody,
  config: SSRPageServerConfig,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  caches: ServerCaches
): Promise<PreviewResult> => {
  const env = (body.env ?? 'main') as Environment;
  const revision = 0;

  const offlineData = await config.adapters.getOfflineData(body.spaceId, env, revision);
  if (!offlineData) {
    return { ok: false, error: 'NO_DATA', message: `No offline data for space ${body.spaceId} (${env}).` };
  }

  let draftOffline = offlineData;
  if (body.operations && body.operations.length > 0) {
    const draft = cloneSpace({ schema: offlineData.schema, style: offlineData.style, connectors: [], actions: [] });

    const validation = validateOperations(draft, body.operations);
    if (!validation.valid) {
      return {
        ok: false,
        error: 'INVALID_OPERATIONS',
        message: 'The operations did not validate.',
        errors: validation.errors
      };
    }

    const outcome = applyOperations(draft, env, body.operations);
    if (outcome.errors.length > 0) {
      return {
        ok: false,
        error: 'APPLY_FAILED',
        message: 'The operations could not be applied.',
        errors: outcome.errors
      };
    }

    draftOffline = { ...offlineData, schema: draft.schema, style: draft.style };
  }

  const pagePath = resolvePagePath(draftOffline.schema, body.pageRef);
  // The render is the expensive half, and a caller heading for a screenshot never reads it — the browser renders
  // the same draft again from the token. So it is done only when asked for.
  let html: string | undefined;
  if (body.includeHtml !== false) {
    ({ body: html } = await buildBody(
      syntheticRequest(pagePath),
      config,
      body.spaceId,
      env,
      revision,
      renderFn,
      pluginManager,
      caches.offlineData,
      undefined,
      draftOffline
    ));
  }

  const reusable = body.mode === 'session';
  const ttlMs = reusable ? (config.preview?.sessionTtlMs ?? 900_000) : (config.preview?.ttlMs ?? 60_000);

  let token: string | undefined;
  if (config.draftStore) {
    token = randomUUID();
    await config.draftStore.put(token, draftOffline, { ttlMs, reusable });
  }

  return {
    ok: true,
    token,
    pagePath,
    html: html ?? '',
    stateVersion: computeVersion(draftOffline),
    ...(token ? { expiresInMs: ttlMs } : {})
  };
};
