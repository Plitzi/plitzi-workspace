import type { FreshnessGroup } from '../../../../../../scope/useFreshnessByStore';
import type { PathFreshness } from '@plitzi/nexus';

/** What a path stands for, when the path itself is an opaque key — a query cache entry is a hash of its request. */
export type PathDescription = { label: string; tags: string[] };

export type DescribePath = (group: FreshnessGroup, path: string) => PathDescription | undefined;

export type FreshnessRowModel = {
  /** The store and path together: two stores can hold the same path. */
  key: string;
  uid: string;
  storeLabel: string;
  path: string;
  label: string;
  tags: string[];
  isStale: boolean;
  /** How long ago it was written, e.g. `12s ago`. */
  age: string;
  /** `18s left` while current, `stale` once it is not. */
  status: string;
  /** The TTL it was written with — not what is left of it, which is what `status` says. */
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

const toRow = (
  group: FreshnessGroup,
  storeLabel: string,
  path: string,
  { updatedAt, expiresAt, ttl }: PathFreshness,
  now: number,
  description: PathDescription | undefined
): FreshnessRowModel => {
  const isStale = now >= expiresAt;
  const finite = Number.isFinite(expiresAt);
  let status = 'no expiry';
  if (isStale) {
    status = 'stale';
  } else if (finite) {
    status = `${formatDuration(expiresAt - now)} left`;
  }

  return {
    key: `${group.entry.uid}:${path}`,
    uid: group.entry.uid,
    storeLabel,
    path,
    label: description?.label ?? path,
    tags: description?.tags ?? [],
    isStale,
    age: `${formatDuration(now - updatedAt)} ago`,
    status,
    ttl: Number.isFinite(ttl) ? formatDuration(ttl) : '∞'
  };
};

/**
 * One row per record of every store, stale ones last so what is still being served is what the panel shows first.
 *
 * `now` is never earlier than the newest write: the clock is a render-time snapshot, and a record written after it
 * read as written in the future — "0s ago" and "0s left" on an answer that was never current at all.
 */
export const toRows = (
  groups: ReadonlyArray<FreshnessGroup>,
  labelOf: (group: FreshnessGroup) => string,
  now: number,
  describe?: DescribePath
): FreshnessRowModel[] => {
  let newest = now;
  for (const group of groups) {
    for (const record of Object.values(group.records)) {
      newest = Math.max(newest, record.updatedAt);
    }
  }

  return groups
    .flatMap(group => {
      const storeLabel = labelOf(group);

      return Object.entries(group.records).map(([path, record]) =>
        toRow(group, storeLabel, path, record, newest, describe?.(group, path))
      );
    })
    .sort(
      (a, b) =>
        Number(a.isStale) - Number(b.isStale) ||
        a.storeLabel.localeCompare(b.storeLabel) ||
        a.label.localeCompare(b.label)
    );
};
