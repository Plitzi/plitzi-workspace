export const DEFAULT_TTL_MS = {
  html: 5 * 60 * 1000, // 5 min — SSR HTML pages
  rsc: 30_000, // 30 s  — RSC endpoint responses
  auth: 5 * 60 * 1000, // 5 min — basic-auth credential checks
  offlineData: 5 * 60 * 1000 // 5 min — schema + styles (expires with html cache)
} as const;
