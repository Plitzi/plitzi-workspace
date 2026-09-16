import clsx from 'clsx';
import { useCallback } from 'react';

import type { FreshnessRowModel } from '../../helpers';

export type FreshnessRowProps = {
  row: FreshnessRowModel;
  onExpire: (path: string) => void;
};

const FreshnessRow = ({ row, onExpire }: FreshnessRowProps) => {
  const handleExpire = useCallback(() => onExpire(row.path), [onExpire, row.path]);

  return (
    <li className="flex items-center gap-2 px-2 py-0.5">
      <span
        className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', row.isStale ? 'bg-zinc-400' : 'bg-emerald-500')}
        title={row.isStale ? 'Stale' : 'Current'}
      />
      <span className="min-w-0 grow truncate font-mono text-zinc-700 dark:text-zinc-200" title={row.path}>
        {row.path}
      </span>
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
