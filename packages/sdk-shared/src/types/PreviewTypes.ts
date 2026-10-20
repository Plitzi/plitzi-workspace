import type { OfflineDataRaw } from './SdkTypes';

/** A short-TTL, one-shot store for unsaved draft offline-data behind a preview token. The SDK ships an
 *  in-memory default (fine for a single replica); a multi-replica deployment injects a shared (e.g. Redis)
 *  implementation so a preview URL resolves on whichever replica the browser lands on. `take` consumes the
 *  token so a preview URL is not replayable. */
/**
 * How long a stashed draft lives, and whether looking at it uses it up.
 *
 * `reusable: false` is the capture path: one token, one render, gone — a URL that leaks buys nobody a second look.
 * `reusable: true` is somebody ITERATING: they reload, they open devtools, they navigate to the next page and back,
 * and a token consumed by the first of those turns the whole loop into "mint another one". Same store, same secret,
 * same expiry; the only difference is whether the read deletes it.
 */
export type DraftPutOptions = {
  ttlMs: number;
  reusable?: boolean;
  /** The space the draft was made from. It is only ever rendered for that space. */
  spaceId: number;
};

/** A stashed draft, and whether the read that resolved it left it there. */
export type DraftEntry = {
  data: OfflineDataRaw;
  reusable: boolean;
  /** The space the draft was made from — see {@link DraftPutOptions.spaceId}. */
  spaceId: number;
};

export type DraftStore = {
  put: (token: string, data: OfflineDataRaw, options: DraftPutOptions) => void | Promise<void>;
  /**
   * Resolves a draft, consuming it unless it was stored as reusable.
   *
   * It answers WHICH it was, rather than leaving the caller to infer it from a second read: the render that resolved
   * a session is the one that has to remember it for the rest of the visit, and "did this token survive" is a fact
   * the store holds and nobody else does.
   */
  take: (token: string) => (DraftEntry | undefined) | Promise<DraftEntry | undefined>;
  /** Ends a reusable draft before its TTL — what "stop previewing" does. A token that is not there is not an error. */
  drop: (token: string) => void | Promise<void>;
};

/** Draft-preview config for the MCP visual-preview tools. When enabled, an internal endpoint at `path`
 *  (guarded by `secret`) applies unsaved edits to a clone, stashes the resulting offline-data under a
 *  one-shot token, and the render path serves it back at `?__pt=<token>`. Off by default. */
export type SSRPreviewConfig = {
  enabled?: boolean;
  /** Internal endpoint path that mints a preview token. Default '/__preview'. */
  path?: string;
  /**
   * Shared secret required in the `x-preview-secret` header; requests without it are rejected.
   *
   * Required for the endpoint to answer at all: the page server that hosts it is the one the public reaches, so an
   * enabled endpoint with no secret refuses every request rather than serving anyone.
   */
  secret?: string;
  /** One-shot token time-to-live in milliseconds. Default 60000. */
  ttlMs?: number;
  /**
   * How long a REUSABLE draft session lives, in milliseconds. Default 900000 (fifteen minutes).
   *
   * Longer than a one-shot token because it is measured against a person's attention rather than an HTTP round trip,
   * and short anyway: a draft is unsaved work that only its author should be looking at, and every minute it stays
   * resolvable is a minute a copied URL keeps working.
   */
  sessionTtlMs?: number;
};
