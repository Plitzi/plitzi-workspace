import type { PathFreshness } from '@plitzi/nexus';

export type FreshnessRowModel = {
  path: string;
  isStale: boolean;
  /** How long ago it was written, e.g. `12s ago`. */
  age: string;
  /** `18s left` while current, `stale` once it is not. */
  status: string;
  /** The TTL it was written with, or what was left of it when an `expire` cut it short. */
  ttl: string;
};

export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

/** One row per record, stale ones last so what is still being served is what the panel shows first. */
export const toRows = (records: Readonly<Record<string, PathFreshness>>, now: number): FreshnessRowModel[] =>
  Object.entries(records)
    .map(([path, { updatedAt, expiresAt }]) => {
      const isStale = now >= expiresAt;
      const finite = Number.isFinite(expiresAt);
      let status = 'no expiry';
      if (isStale) {
        status = 'stale';
      } else if (finite) {
        status = `${formatDuration(expiresAt - now)} left`;
      }

      return {
        path,
        isStale,
        age: `${formatDuration(now - updatedAt)} ago`,
        status,
        ttl: finite ? formatDuration(expiresAt - updatedAt) : '∞'
      };
    })
    .sort((a, b) => Number(a.isStale) - Number(b.isStale) || a.path.localeCompare(b.path));
