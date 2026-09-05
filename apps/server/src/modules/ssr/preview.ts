import { PREVIEW_COOKIE, readDraftToken } from '../../core/previewToken';

import type { DraftStore, OfflineDataRaw, SSRRequest, SSRServerConfig } from '@plitzi/sdk-shared';

/** The READ side of draft-preview: a render resolving a stashed draft from its token. The write side — applying
 *  unsaved operations and rendering the result — lives in `@plitzi/sdk-mcp`, which is what knows how to interpret an
 *  operation; a page-only deployment keeps this much and never loads that. */

/** In-memory draft store — the default when the consumer injects none. Fine for a single replica; a multi-replica
 *  deployment must inject a shared store so a preview URL resolves on any replica. */
export const createMemoryDraftStore = (): DraftStore => {
  const store = new Map<string, { data: OfflineDataRaw; expiresAt: number; reusable: boolean }>();

  return {
    put(token, data, { ttlMs, reusable = false }) {
      store.set(token, { data, expiresAt: Date.now() + ttlMs, reusable });
    },
    take(token) {
      const hit = store.get(token);
      if (!hit) {
        return undefined;
      }

      // A reusable draft survives being looked at; a one-shot one does not, and is deleted whether or not it had
      // already expired — an entry that can never be served again has no reason to be held.
      if (!hit.reusable || hit.expiresAt <= Date.now()) {
        store.delete(token);
      }

      return hit.expiresAt > Date.now() ? { data: hit.data, reusable: hit.reusable } : undefined;
    },
    drop(token) {
      store.delete(token);
    }
  };
};

/** What a draft render has to say about itself, so nothing downstream has to ask the store a second time. */
export type DraftOverride = {
  data: OfflineDataRaw;
  token: string;
  /** Whether the token survived the read — which is what decides if the visit is worth remembering in a cookie. */
  reusable: boolean;
};

/**
 * Resolve the draft this request is looking at, if any.
 *
 * Returns undefined on a normal request (renders persisted state) and on a token the store no longer has — expired,
 * dropped, or a one-shot that has already been rendered once.
 */
export const takeDraftOverride = async (
  req: SSRRequest,
  config: SSRServerConfig
): Promise<DraftOverride | undefined> => {
  const token = readDraftToken(req);
  if (!token || !config.draftStore) {
    return undefined;
  }

  const entry = await config.draftStore.take(token);

  return entry ? { ...entry, token } : undefined;
};

/** The `Set-Cookie` that carries a draft session through the rest of the visit. */
export const draftSessionCookie = (req: SSRRequest, token: string, ttlMs: number): string =>
  [
    `${PREVIEW_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(ttlMs / 1000))}`,
    ...(req.protocol === 'https' ? ['Secure'] : [])
  ].join('; ');
