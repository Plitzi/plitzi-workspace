import clsx from 'clsx';
import { useCallback } from 'react';

import PayloadView from '../../../../../PayloadView';

import type { FreshnessRowModel } from '../../../../../../freshness';

export type CacheRowProps = {
  row: FreshnessRowModel;
  /** Open rows show what the path holds, so a reader never has to go and find it in the state tree. */
  isOpen: boolean;
  value: unknown;
  onToggle: (key: string) => void;
  onExpire: (uid: string, path: string) => void;
  onForget: (uid: string, path: string) => void;
};

/**
 * One cached path, said in full and on screen: which store it is in, what it stands for, how long it has left and how
 * much of its life that is. Nothing here is a tooltip — the whole point of the tab is that a glance answers it.
 */
const CacheRow = ({ row, isOpen, value, onToggle, onExpire, onForget }: CacheRowProps) => {
  const handleToggle = useCallback(() => onToggle(row.key), [onToggle, row.key]);
  const handleExpire = useCallback(() => onExpire(row.uid, row.path), [onExpire, row.uid, row.path]);
  const handleForget = useCallback(() => onForget(row.uid, row.path), [onForget, row.uid, row.path]);

  return (
    <li className="border-ui-line border-b last:border-0">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          className="flex min-w-0 grow cursor-pointer items-center gap-2 text-left"
          onClick={handleToggle}
          aria-expanded={isOpen}
        >
          <i
            className={clsx(
              'fa-solid text-ui-fg-subtle w-2 shrink-0 text-[9px]',
              isOpen ? 'fa-chevron-down' : 'fa-chevron-right'
            )}
          />
          <span className="bg-ui-raised text-ui-fg-subtle shrink-0 rounded-sm px-1 text-[9px] uppercase">
            {row.storeLabel}
          </span>
          <span className="text-ui-fg min-w-0 grow truncate font-mono text-[11px]">{row.label}</span>
          {row.tags.map(tag => (
            <span
              key={tag}
              className="shrink-0 rounded bg-violet-500/15 px-1.5 text-[10px] text-violet-600 dark:text-violet-400"
            >
              {tag}
            </span>
          ))}
        </button>
        <span
          className={clsx(
            'w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums',
            row.isStale
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          )}
        >
          {row.status}
        </span>
        {/* Nothing renders it, so there is nothing to ask again: what is left to do with it is let it go. */}
        {row.inUse === false ? (
          <button
            className="w-14 shrink-0 cursor-pointer rounded px-1.5 text-[11px] text-violet-600 hover:bg-violet-500/15 dark:text-violet-400"
            onClick={handleForget}
          >
            Forget
          </button>
        ) : (
          <button
            className="w-14 shrink-0 cursor-pointer rounded px-1.5 text-[11px] text-violet-600 hover:bg-violet-500/15 dark:text-violet-400"
            onClick={handleExpire}
          >
            Expire
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 px-2 pb-1.5 pl-6">
        <span className="bg-ui-raised h-1 min-w-0 grow overflow-hidden rounded-full">
          <span
            className={clsx('block h-full rounded-full', row.isStale ? 'bg-amber-500/60' : 'bg-emerald-500/80')}
            style={{ width: `${Math.round(row.progress * 100)}%` }}
          />
        </span>
        <span className="text-ui-fg-subtle shrink-0 text-[10px] tabular-nums">
          written {row.age} · ttl {row.ttl}
          {row.inUse === false && ` · nothing renders it${row.kept ? ` · ${row.kept}` : ''}`}
        </span>
      </div>
      {isOpen && (
        <div className="border-ui-line bg-ui-raised max-h-56 overflow-auto border-t px-2 py-1">
          <div className="text-ui-fg-subtle pb-1 font-mono text-[10px]">{row.path}</div>
          <PayloadView value={value} />
        </div>
      )}
    </li>
  );
};

export default CacheRow;
