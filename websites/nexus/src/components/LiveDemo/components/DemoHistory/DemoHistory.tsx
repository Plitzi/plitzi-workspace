import { useStoreHistory } from '@plitzi/nexus';
import { useMemo } from 'react';

import DemoHistoryEntry from '../DemoHistoryEntry';

import type { DemoState } from '../../demoStore';

const DemoHistory = () => {
  const { entries, index, canUndo, canRedo, undo, redo, travelTo, clear } = useStoreHistory<DemoState>();

  const ordered = useMemo(
    () => entries.map((entry, originalIndex) => ({ entry, originalIndex })).reverse(),
    [entries]
  );

  return (
    <div className="flex min-w-0 flex-col grow basis-0">
      <div className="flex items-center gap-1.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition enabled:hover:border-brand-500 enabled:hover:text-white disabled:opacity-40"
        >
          ↶ Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition enabled:hover:border-brand-500 enabled:hover:text-white disabled:opacity-40"
        >
          ↷ Redo
        </button>
        <span className="ml-auto text-[11px] text-zinc-500">
          {index + 1} / {entries.length}
        </span>
        <button
          onClick={clear}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-brand-500 hover:text-white"
        >
          Clear
        </button>
      </div>

      <div className="mt-3 basis-0 grow flex flex-col space-y-0.5 overflow-y-auto rounded-lg border border-ink-700 bg-ink-950 p-1.5">
        {ordered.map(({ entry, originalIndex }) => (
          <DemoHistoryEntry
            key={originalIndex}
            index={originalIndex}
            path={entry.path}
            value={entry.value}
            isActive={originalIndex === index}
            isFuture={originalIndex > index}
            onSelect={travelTo}
          />
        ))}
      </div>
    </div>
  );
};

export default DemoHistory;
