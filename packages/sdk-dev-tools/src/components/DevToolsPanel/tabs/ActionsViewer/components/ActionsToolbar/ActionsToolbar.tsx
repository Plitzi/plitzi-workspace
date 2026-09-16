import clsx from 'clsx';
import { useCallback } from 'react';

import type { RunFilter } from '../../helpers';
import type { ChangeEvent } from 'react';

const FILTERS = [
  { id: 'all', label: 'All', icon: 'fa-solid fa-list' },
  { id: 'live', label: 'Running', icon: 'fa-solid fa-circle-notch' },
  { id: 'failed', label: 'Failed', icon: 'fa-solid fa-circle-exclamation' }
] as const;

export type ActionsToolbarProps = {
  filter: RunFilter;
  query: string;
  liveCount: number;
  runCount: number;
  onFilterChange: (filter: RunFilter) => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
};

const ActionsToolbar = ({
  filter,
  query,
  liveCount,
  runCount,
  onFilterChange,
  onQueryChange,
  onClear
}: ActionsToolbarProps) => {
  const handleFilterChange = useCallback((next: RunFilter) => () => onFilterChange(next), [onFilterChange]);
  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value),
    [onQueryChange]
  );

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-stretch gap-1">
        {FILTERS.map(item => {
          const isActive = filter === item.id;

          return (
            <button
              key={item.id}
              onClick={handleFilterChange(item.id)}
              aria-pressed={isActive}
              className={clsx('flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors', {
                'bg-violet-500 text-white': isActive,
                'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700': !isActive
              })}
            >
              <i className={clsx(item.icon, item.id === 'live' && liveCount > 0 && 'fa-spin')} />
              {item.label}
              {item.id === 'live' && liveCount > 0 && <span className="tabular-nums">{liveCount}</span>}
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={query}
        onChange={handleQueryChange}
        placeholder="Filter by action, step or run id"
        className="h-6 min-w-0 grow rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-700 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      />

      <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums dark:text-zinc-500">{runCount} runs</span>
      <button
        onClick={onClear}
        className="flex h-6 shrink-0 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <i className="fa-solid fa-trash" />
        Clear
      </button>
    </div>
  );
};

export default ActionsToolbar;
