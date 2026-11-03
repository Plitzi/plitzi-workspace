import { DEFAULT_CACHE_BYTES, DEFAULT_TTL_MS } from './defaults';
import { sizeOfPage } from './pages';
import { TtlCache } from './TtlCache';

import type { CachedPage } from './pages';

export type ServerCaches = {
  html: TtlCache<CachedPage> | undefined;
  rsc: TtlCache<string> | undefined;
  /** JSON-serialized OfflineDataRaw — keyed by spaceId|env|revision, same TTL as html. */
  offlineData: TtlCache<string> | undefined;
  /**
   * The pages being rendered right now, by key: a request for one of them waits for that render instead of starting
   * its own. Without it a page invalidated by a publish, or expired, was rendered once per visitor who asked for it
   * in the second its render took — on a busy page, tens of renders of the same thing at once.
   */
  rendering: Map<string, Promise<CachedPage | undefined>>;
};

export type ServerCachesOptions = {
  htmlTtlMs?: number;
  rscTtlMs?: number;
  /** What the rendered pages may take, in bytes. */
  htmlBytes?: number;
  /** How long past its TTL a page is served while it is rendered again. */
  staleMs?: number;
};

const sizeOfString = (value: string): number => value.length;

export const createServerCaches = ({
  htmlTtlMs = DEFAULT_TTL_MS.html,
  rscTtlMs = DEFAULT_TTL_MS.rsc,
  htmlBytes = DEFAULT_CACHE_BYTES.html,
  staleMs = DEFAULT_TTL_MS.stale
}: ServerCachesOptions = {}): ServerCaches => ({
  html:
    htmlTtlMs > 0
      ? new TtlCache<CachedPage>(htmlTtlMs, 5000, { maxBytes: htmlBytes, sizeOf: sizeOfPage, staleMs })
      : undefined,
  rsc:
    rscTtlMs > 0
      ? new TtlCache<string>(rscTtlMs, 5000, { maxBytes: DEFAULT_CACHE_BYTES.rsc, sizeOf: sizeOfString })
      : undefined,
  offlineData:
    htmlTtlMs > 0
      ? new TtlCache<string>(htmlTtlMs, 500, { maxBytes: DEFAULT_CACHE_BYTES.offlineData, sizeOf: sizeOfString })
      : undefined,
  rendering: new Map()
});

export const destroyServerCaches = ({ html, rsc, offlineData, rendering }: ServerCaches): void => {
  html?.destroy();
  rsc?.destroy();
  offlineData?.destroy();
  rendering.clear();
};
