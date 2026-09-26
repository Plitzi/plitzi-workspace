import { DEFAULT_TTL_MS } from './defaults';
import { TtlCache } from './TtlCache';

import type { CompressedBodies } from '@plitzi/sdk-shared';

/** A rendered page, and the compressed forms of it that have been sent — kept together, so they expire together. */
export type CachedPage = { html: string; compressed: CompressedBodies };

export type ServerCaches = {
  html: TtlCache<CachedPage> | undefined;
  rsc: TtlCache<string> | undefined;
  /** JSON-serialized OfflineDataRaw — keyed by spaceId|env|revision, same TTL as html. */
  offlineData: TtlCache<string> | undefined;
};

export const createServerCaches = (htmlTtlMs = DEFAULT_TTL_MS.html, rscTtlMs = DEFAULT_TTL_MS.rsc): ServerCaches => ({
  html: htmlTtlMs > 0 ? new TtlCache<CachedPage>(htmlTtlMs) : undefined,
  rsc: rscTtlMs > 0 ? new TtlCache<string>(rscTtlMs) : undefined,
  offlineData: htmlTtlMs > 0 ? new TtlCache<string>(htmlTtlMs) : undefined
});

export const destroyServerCaches = ({ html, rsc, offlineData }: ServerCaches): void => {
  html?.destroy();
  rsc?.destroy();
  offlineData?.destroy();
};
