import clsx from 'clsx';
import { useCallback } from 'react';

import type { FreshnessRowModel } from '../../helpers';

export type FreshnessRowProps = {
  row: FreshnessRowModel;
  onExpire: (uid: string, path: string) => void;
};

const FreshnessRow = ({ row, onExpire }: FreshnessRowProps) => {
  const handleExpire = useCallback(() => onExpire(row.uid, row.path), [onExpire, row.uid, row.path]);

  return (
    <li className="flex items-center gap-2 px-2 py-0.5">
      <span
        className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', row.isStale ? 'bg-zinc-400' : 'bg-emerald-500')}
        title={row.isStale ? 'Stale' : 'Current'}
      />
      <span
        className="max-w-32 shrink-0 truncate rounded bg-zinc-200/70 px-1.5 text-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-300"
        title="Store"
      >
        {row.storeLabel}
      </span>
      <span
        className="min-w-0 grow truncate font-mono text-zinc-700 dark:text-zinc-200"
        title={row.label === row.path ? row.path : `${row.label}\n${row.path}`}
      >
        {row.label}
      </span>
      {row.tags.map(tag => (
        <span
          key={tag}
          className="shrink-0 rounded bg-violet-500/15 px-1.5 text-violet-600 dark:text-violet-300"
          title="Tag — invalidated by this name"
        >
          {tag}
        </span>
      ))}
      <span className="shrink-0 text-zinc-400 tabular-nums dark:text-zinc-500" title="Written">
        {row.age}
      </span>
      <span className="shrink-0 text-zinc-400 tabular-nums dark:text-zinc-500" title="TTL">
        ttl {row.ttl}
      </span>
      <span
        className={clsx(
          'w-20 shrink-0 text-right tabular-nums',
          row.isStale ? 'text-zinc-400 dark:text-zinc-500' : 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {row.status}
      </span>
      <button
        className="shrink-0 cursor-pointer rounded px-1.5 text-violet-600 hover:bg-violet-500/15 dark:text-violet-300"
        onClick={handleExpire}
        title="Mark stale now — anything listening refreshes it"
      >
        Expire
      </button>
    </li>
  );
};

export default FreshnessRow;
