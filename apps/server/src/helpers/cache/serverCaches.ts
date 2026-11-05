import { TtlCache } from '@plitzi/sdk-kernel/cache';

import { DEFAULT_CACHE_BYTES, DEFAULT_TTL_MS } from './defaults';
import { sizeOfPage } from './pages';
import { createRenderTurns } from '../../modules/ssr/renderTurns';
import { spaceDocument } from '../hydrationPayload';

import type { CachedPage } from './pages';
import type { RenderTurns } from '../../modules/ssr/renderTurns';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export type ServerCaches = {
  html: TtlCache<CachedPage> | undefined;
  rsc: TtlCache<string> | undefined;
  /** The space as read for a render, shared and never written to — keyed by spaceId|env|revision, the html's TTL. */
  offlineData: TtlCache<OfflineDataRaw> | undefined;
  /**
   * The pages being rendered right now, by key: a request for one of them waits for that render instead of starting
   * its own. Without it a page invalidated by a publish, or expired, was rendered once per visitor who asked for it
   * in the second its render took — on a busy page, tens of renders of the same thing at once.
   */
  rendering: Map<string, Promise<CachedPage | undefined>>;
  /** The renders each space has going in this process, held to its `renderLimit`. */
  turns: RenderTurns;
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
      ? new TtlCache<CachedPage>(htmlTtlMs, 5000, {
          maxBytes: htmlBytes,
          sizeOf: sizeOfPage,
          staleMs
        })
      : undefined,
  rsc:
    rscTtlMs > 0
      ? new TtlCache<string>(rscTtlMs, 5000, {
          maxBytes: DEFAULT_CACHE_BYTES.rsc,
          sizeOf: sizeOfString
        })
      : undefined,
  offlineData:
    htmlTtlMs > 0
      ? new TtlCache<OfflineDataRaw>(htmlTtlMs, 500, {
          maxBytes: DEFAULT_CACHE_BYTES.offlineData,
          // Measured as the text it is sent as, made once per space object and kept for the page's payload anyway.
          sizeOf: offlineData => spaceDocument(offlineData).json.length
        })
      : undefined,
  rendering: new Map(),
  turns: createRenderTurns()
});

export const destroyServerCaches = ({ html, rsc, offlineData, rendering }: ServerCaches): void => {
  html?.destroy();
  rsc?.destroy();
  offlineData?.destroy();
  rendering.clear();
};
