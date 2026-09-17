import formatDuration from './formatDuration';

import type { FreshnessGroup } from './useFreshnessByStore';
import type { PathFreshness } from '@plitzi/nexus';

/** Whether anything is rendering what a path holds, and when it is let go of if nothing starts. */
export type PathUsage = { inUse: boolean; collectAt?: number };

/** What a path stands for, when the path itself is an opaque key — a query cache entry is a hash of its request. */
export type PathDescription = { label: string; tags: string[]; usage?: PathUsage };

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
  /** What is left of the TTL, `1` down to `0` — a bar says "half gone" in a glance that a countdown does not. */
  progress: number;
  /** Whether anything renders this, where that is known: only what can be let go of can be offered to. */
  inUse?: boolean;
  /** `forgotten in 3m 58s`, while a grace period is running. */
  kept?: string;
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
    ttl: Number.isFinite(ttl) ? formatDuration(ttl) : '∞',
    inUse: description?.usage?.inUse,
    kept: description?.usage?.collectAt
      ? `forgotten in ${formatDuration(description.usage.collectAt - now)}`
      : undefined,
    // A record with no expiry never runs down, and one already stale has nothing left.
    progress: isStale ? 0 : Math.min(1, Number.isFinite(ttl) ? (expiresAt - now) / ttl : 1)
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
