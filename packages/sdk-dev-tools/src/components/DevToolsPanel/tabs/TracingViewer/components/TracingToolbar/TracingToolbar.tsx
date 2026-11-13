import clsx from 'clsx';
import { useCallback } from 'react';

import type { TracingView } from '../../helpers';

const VIEWS = [
  { id: 'ranked', label: 'Ranked', icon: 'fa-solid fa-ranking-star' },
  { id: 'flamegraph', label: 'Flamegraph', icon: 'fa-solid fa-fire' },
  { id: 'hotspots', label: 'Hotspots', icon: 'fa-solid fa-temperature-three-quarters' }
] as const;

export type TracingToolbarProps = {
  view: TracingView;
  persist: boolean;
  commitCount: number;
  onClear: () => void;
  onViewChange: (view: TracingView) => void;
  onPersistChange: (persist: boolean) => void;
};

const TracingToolbar = ({
  view,
  persist,
  commitCount,
  onClear,
  onViewChange,
  onPersistChange
}: TracingToolbarProps) => {
  const handleViewChange = useCallback((next: TracingView) => () => onViewChange(next), [onViewChange]);
  const handleTogglePersist = useCallback(() => onPersistChange(!persist), [persist, onPersistChange]);

  return (
    <div className="border-ui-line bg-ui-panel flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
      <div className="flex items-stretch gap-1">
        {VIEWS.map(item => {
          const isActive = view === item.id;

          return (
            <button
              key={item.id}
              onClick={handleViewChange(item.id)}
              aria-pressed={isActive}
              className={clsx('flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors', {
                'bg-violet-500 text-white': isActive,
                'text-ui-fg-muted hover:bg-ui-hover': !isActive
              })}
            >
              <i className={item.icon} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-ui-fg-subtle text-[10px]">{commitCount} commits</span>
        <button
          onClick={handleTogglePersist}
          aria-pressed={persist}
          title="Keep the recorded commits when navigating to another page"
          className={clsx('flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors', {
            'bg-violet-500 text-white': persist,
            'text-ui-fg-muted hover:bg-ui-hover': !persist
          })}
        >
          <i className="fa-solid fa-thumbtack" />
          Persist
        </button>
        <button
          onClick={onClear}
          className="text-ui-fg-muted hover:bg-ui-hover flex h-6 items-center gap-1 rounded px-2 text-xs font-medium"
        >
          <i className="fa-solid fa-trash" />
          Clear
        </button>
      </div>
    </div>
  );
};

export default TracingToolbar;
