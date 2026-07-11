import { randomUUID } from 'node:crypto';

import { buildBody } from './buildBody';
import { cloneSpace, computeVersion, findPageByRef, getPageElements } from '../mcp/helpers';
import { applyOperations, validateOperations } from '../mcp/tools';

import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { PreviewRequestBody, PreviewResult } from '../mcp/previewTypes';
import type {
  DraftStore,
  Environment,
  OfflineDataRaw,
  Schema,
  SSRRequest,
  SSRServerConfig,
  SSRTemplateFn
} from '@plitzi/sdk-shared';

// Query param carrying a one-shot draft-preview token. A normal render sees it, resolves the stashed draft
// offline-data from the draft store, and renders that instead of the persisted state.
export const PREVIEW_TOKEN_PARAM = '__pt';

/** In-memory one-shot draft store — the default when the consumer injects none. Fine for a single replica;
 *  a multi-replica deployment must inject a shared store so a preview URL resolves on any replica. */
export const createMemoryDraftStore = (): DraftStore => {
  const store = new Map<string, { data: OfflineDataRaw; expiresAt: number }>();

  return {
    put(token, data, ttlMs) {
      store.set(token, { data, expiresAt: Date.now() + ttlMs });
    },
    take(token) {
      const hit = store.get(token);
      if (!hit) {
        return undefined;
      }

      store.delete(token);

      return hit.expiresAt > Date.now() ? hit.data : undefined;
    }
  };
};

/** Consume the draft override for a render, if the request carries a valid preview token. Returns undefined on
 *  a normal request (renders persisted state) or when the token is unknown/expired (one-shot / TTL). */
export const takeDraftOverride = async (
  req: SSRRequest,
  config: SSRServerConfig
): Promise<OfflineDataRaw | undefined> => {
  const token = req.query[PREVIEW_TOKEN_PARAM];
  if (!token || !config.draftStore) {
    return undefined;
  }

  return config.draftStore.take(token);
};

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
 *  draft to full HTML via the SSR pipeline, and stash the draft under a one-shot token so a browser can fetch
 *  the exact same render at `?__pt=<token>` (for screenshots). With no operations it previews persisted state. */
export const createPreview = async (
  body: PreviewRequestBody,
  config: SSRServerConfig,
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
    const draft = cloneSpace({ schema: offlineData.schema, style: offlineData.style });

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
  const { body: html } = await buildBody(
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
  );

  let token: string | undefined;
  if (config.draftStore) {
    token = randomUUID();
    await config.draftStore.put(token, draftOffline, config.preview?.ttlMs ?? 60000);
  }

  return { ok: true, token, pagePath, html: html ?? '', stateVersion: computeVersion(draftOffline) };
};
