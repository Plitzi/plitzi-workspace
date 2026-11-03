import { createHash } from 'node:crypto';

import { DEFAULT_TTL_MS, fromSharedPage, keepPage, toSharedPage } from '../../helpers/cache';
import { serverLog } from '../../helpers/serverLog';

import type { CachedPage, ServerCaches } from '../../helpers/cache';
import type { ResolvedCompression } from '../../helpers/compress';
import type { SharedPageFacts, SharedPageStore, SSRPageServerConfig } from '@plitzi/sdk-shared';

/** Where one request's page is kept: this process's copy, and — for a page rendered for nobody in particular — the
 *  copy every replica shares. */
export type PageSlot = {
  caches: ServerCaches;
  key: string;
  /** Only a page rendered for nobody in particular is shared: a signed-in visitor's stays in the process that drew it. */
  shared?: { store: SharedPageStore; key: string; facts: SharedPageFacts };
  ttlMs: number;
  staleMs: number;
  compression: ResolvedCompression;
};

export type KeptPage = { page: CachedPage; stale: boolean };

const LABEL = 'SSR cache';

/** The key a page is shared under: a digest, so the visitor's token a key holds is never written to a store. */
const sharedKeyOf = (key: string): string => createHash('sha256').update(key).digest('base64url');

export const pageSlot = (
  config: SSRPageServerConfig,
  caches: ServerCaches,
  key: string,
  facts: SharedPageFacts,
  anonymous: boolean,
  compression: ResolvedCompression
): PageSlot => {
  const store = config.cache?.store;

  return {
    caches,
    key,
    ...(store && anonymous ? { shared: { store, key: sharedKeyOf(key), facts } } : {}),
    ttlMs: config.cacheTtlMs ?? DEFAULT_TTL_MS.html,
    staleMs: config.cache?.staleMs ?? DEFAULT_TTL_MS.stale,
    compression
  };
};

/**
 * The page as kept: this process's copy, else the shared one — taken into this process, so the next request does not
 * ask the store again. A store that cannot answer is a miss, said in the log: the page is rendered, not refused.
 */
export const readPage = async ({ caches, key, shared, ttlMs, staleMs }: PageSlot): Promise<KeptPage | undefined> => {
  const local = caches.html?.read(key);
  if (local) {
    return { page: local.value, stale: local.stale };
  }

  if (!shared) {
    return undefined;
  }

  const found = await shared.store.get(shared.key).catch((error: unknown) => {
    serverLog.warn(LABEL, 'The shared page store did not answer; the page is rendered here instead', error);

    return undefined;
  });
  const age = found ? Date.now() - found.renderedAt : Infinity;
  if (!found || age > ttlMs + staleMs) {
    return undefined;
  }

  const page = fromSharedPage(found);
  caches.html?.set(key, page, found.renderedAt);

  return { page, stale: age > ttlMs };
};

/** Keeps a page just rendered, here and in the shared store, and hands back what was kept. */
export const storePage = ({ caches, key, shared, ttlMs, staleMs, compression }: PageSlot, html: string): CachedPage => {
  const page = keepPage(html, compression);
  const renderedAt = Date.now();
  caches.html?.set(key, page, renderedAt);

  if (shared) {
    shared.store
      .set(shared.key, toSharedPage(page, renderedAt), shared.facts, ttlMs + staleMs)
      .catch((error: unknown) => {
        serverLog.warn(LABEL, 'A page could not be put in the shared page store; the other replicas render it', error);
      });
  }

  return page;
};

/** A render this request took on: what the requests for the same page wait on instead of rendering it too. */
export type RenderClaim = {
  /** Keeps the page this render made, or — with nothing to keep — lets the waiting requests render their own. */
  keep: (html: string | undefined) => CachedPage | undefined;
  /** Done, kept or not: a render that failed or was refused must not hold the requests waiting on it. */
  release: () => void;
};

/**
 * Takes on rendering the page, for every request that wants it meanwhile. Taken in the same turn as the look that
 * found nobody rendering it — with an `await` between the two, every request of a burst found nobody and rendered.
 */
export const claimRender = (slot: PageSlot): RenderClaim => {
  const { rendering } = slot.caches;
  let settle: (page: CachedPage | undefined) => void = () => undefined;
  const promise = new Promise<CachedPage | undefined>(resolve => {
    settle = resolve;
  });
  rendering.set(slot.key, promise);

  return {
    keep: html => {
      const page = html === undefined ? undefined : storePage(slot, html);
      settle(page);

      return page;
    },
    release: () => {
      settle(undefined);
      if (rendering.get(slot.key) === promise) {
        rendering.delete(slot.key);
      }
    }
  };
};

/** The render another request started for this page, which this one may wait on rather than render it too. */
export const renderingNow = (slot: PageSlot): Promise<CachedPage | undefined> | undefined =>
  slot.caches.rendering.get(slot.key);
