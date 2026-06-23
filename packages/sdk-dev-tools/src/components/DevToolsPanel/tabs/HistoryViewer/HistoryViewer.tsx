import { useCallback, useMemo, useState } from 'react';

import { useStoreHistory } from '@plitzi/nexus/react';

import HistoryEntryItem from './components/HistoryEntryItem';
import HistoryToolbar from './components/HistoryToolbar';
import { matchesFilter } from './helpers';

import type { CommonState } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const HistoryViewer = () => {
  const { entries, index, canUndo, canRedo, undo, redo, travelTo, clear } = useStoreHistory<CommonState>();
  const [filter, setFilter] = useState('');

  // Newest first (the store records oldest → newest), keeping the original index so time-travel stays exact while
  // the visible set is filtered down.
  const ordered = useMemo(
    () =>
      entries
        .map((entry, originalIndex) => ({ entry, originalIndex }))
        .filter(({ entry }) => matchesFilter(entry, filter))
        .reverse(),
    [entries, filter]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();
      const position = ordered.findIndex(item => item.originalIndex === index);
      let nextPosition: number;
      if (position === -1) {
        nextPosition = event.key === 'ArrowDown' ? 0 : ordered.length - 1;
      } else {
        nextPosition = event.key === 'ArrowUp' ? position - 1 : position + 1;
      }

      if (nextPosition < 0 || nextPosition >= ordered.length) {
        return;
      }

      travelTo(ordered[nextPosition].originalIndex);
    },
    [ordered, index, travelTo]
  );

  return (
    <div className="flex h-full w-full flex-col">
      <HistoryToolbar
        index={index}
        total={entries.length}
        canUndo={canUndo}
        canRedo={canRedo}
        filter={filter}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
        onFilterChange={setFilter}
      />

      <div tabIndex={0} onKeyDown={handleKeyDown} className="flex flex-1 flex-col overflow-y-auto outline-none">
        {ordered.length === 0 && (
          <div className="flex grow flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
            <i className="fa-solid fa-clock-rotate-left text-3xl opacity-20" />
            <span className="text-xs">{filter ? 'No entries match the filter' : 'No history yet'}</span>
          </div>
        )}
        {ordered.map(({ entry, originalIndex }) => (
          <HistoryEntryItem
            key={originalIndex}
            index={originalIndex}
            path={entry.path}
            value={entry.value}
            timestamp={entry.timestamp}
            isSelected={originalIndex === index}
            isFuture={originalIndex > index}
            onSelect={travelTo}
          />
        ))}
      </div>
    </div>
  );
};

export default HistoryViewer;
