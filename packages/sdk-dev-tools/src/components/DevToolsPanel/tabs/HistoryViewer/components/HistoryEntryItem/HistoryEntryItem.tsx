import clsx from 'clsx';
import { useCallback, useEffect, useRef } from 'react';

import { formatTime, previewValue } from '../../helpers';

import type { Path } from '@plitzi/nexus';

export type HistoryEntryItemProps = {
  index: number;
  path?: Path;
  value?: unknown;
  timestamp: number;
  isSelected: boolean;
  isFuture: boolean;
  onSelect: (index: number) => void;
};

const HistoryEntryItem = ({ index, path, value, timestamp, isSelected, isFuture, onSelect }: HistoryEntryItemProps) => {
  const ref = useRef<HTMLButtonElement | null>(null);

  const handleClick = useCallback(() => onSelect(index), [onSelect, index]);

  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className={clsx(
        'flex w-full flex-col gap-0.5 border-b border-zinc-100 px-3 py-1.5 text-left font-mono text-xs dark:border-zinc-800',
        {
          'bg-violet-600 text-white dark:bg-violet-600': isSelected,
          'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60': !isSelected,
          'opacity-50': isFuture
        }
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className="grow truncate">
          {path ?? <span className="italic opacity-70">{index === 0 ? 'initial state' : 'replace'}</span>}
        </span>
        <span className="shrink-0 text-[10px] opacity-70">{formatTime(timestamp)}</span>
      </div>
      {value !== undefined && <span className="w-full truncate text-[10px] opacity-70">{previewValue(value)}</span>}
    </button>
  );
};

export default HistoryEntryItem;
