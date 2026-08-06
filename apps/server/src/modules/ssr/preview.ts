import { PREVIEW_TOKEN_PARAM } from '../../core/previewToken';

import type { DraftStore, OfflineDataRaw, SSRRequest, SSRServerConfig } from '@plitzi/sdk-shared';

/** The READ side of draft-preview: a render resolving a stashed draft from its one-shot token. The write side —
 *  applying unsaved operations and rendering the result — lives in `@plitzi/sdk-mcp`, which is what knows how to
 *  interpret an operation; a page-only deployment keeps this much and never loads that. */

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
