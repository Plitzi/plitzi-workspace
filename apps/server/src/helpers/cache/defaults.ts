export const DEFAULT_TTL_MS = {
  html: 5 * 60 * 1000, // 5 min — SSR HTML pages
  rsc: 30_000, // 30 s  — RSC endpoint responses
  auth: 5 * 60 * 1000, // 5 min — basic-auth credential checks
  offlineData: 5 * 60 * 1000, // 5 min — schema + styles (expires with html cache)
  stale: 60_000 // 1 min — how long past its TTL a page is served while it is rendered again
};

/**
 * What each cache of one process may hold, in bytes. Bounded by bytes because entries are anything but alike: a
 * landing page's documents are a megabyte, a blog post's answer a few KB — 500 entries was 5 MB or 500 MB.
 */
export const DEFAULT_CACHE_BYTES = {
  html: 128 * 1024 * 1024,
  /** The pages every replica shares (`createRedisPageStore`). */
  store: 128 * 1024 * 1024,
  rsc: 16 * 1024 * 1024,
  offlineData: 32 * 1024 * 1024
};

/**
 * The parameters a link carries for analytics: a page is rendered and cached as if they were absent — every campaign
 * link would otherwise be a page of its own, rendered for the one visitor who followed it.
 */
export const DEFAULT_IGNORED_QUERY_PARAMS: readonly string[] = [
  'utm_*',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'msclkid',
  'yclid',
  'twclid',
  'ttclid',
  'li_fat_id',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'mkt_tok'
];
