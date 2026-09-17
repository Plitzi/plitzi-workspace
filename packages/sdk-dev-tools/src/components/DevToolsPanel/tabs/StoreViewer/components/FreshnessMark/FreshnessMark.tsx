import clsx from 'clsx';

import { formatDuration } from '../../../../../../freshness';

import type { PathFreshness } from '@plitzi/nexus';

export type FreshnessMarkProps = {
  record: PathFreshness;
  /** A clock the caller moves, so every mark on the tree counts down in step. */
  now: number;
};

/**
 * What a path in the state tree is worth in time: how long before it stops being current, or that it already has.
 *
 * On the path itself, because the question a reader arrives at the tree with is about the state in front of them —
 * which of these is cached, and for how much longer. A path with no mark was written with no `ttl` at all, which is
 * every path unless somebody asked for one. The rest of what there is to say about it is the Cache tab's job, so
 * nothing here hides behind a tooltip.
 */
const FreshnessMark = ({ record: { expiresAt }, now }: FreshnessMarkProps) => {
  const isStale = now >= expiresAt;
  const left = Number.isFinite(expiresAt) ? `${formatDuration(expiresAt - now)} left` : 'no expiry';

  return (
    <span
      className={clsx(
        'ml-1 rounded px-1 align-middle text-[10px] font-medium',
        isStale
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      )}
    >
      {isStale ? 'stale' : left}
    </span>
  );
};

export default FreshnessMark;
