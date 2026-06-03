import clsx from 'clsx';

import { useStoreHistory } from '@plitzi/sdk-store/history';

import type { CommonState } from '@plitzi/sdk-shared';

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour12: false }) +
  '.' +
  String(timestamp % 1000).padStart(3, '0');

const previewValue = (value: unknown): string => {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const fallback = Array.isArray(value) ? '[…]' : '{…}';
  let serialized: string;
  try {
    serialized = JSON.stringify(value) || fallback;
  } catch {
    serialized = fallback;
  }

  return serialized.length > 120 ? serialized.slice(0, 120) + '…' : serialized;
};

const HistoryViewer = () => {
  const { entries, index, canUndo, canRedo, undo, redo, travelTo, clear } = useStoreHistory<CommonState>();

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 enabled:hover:bg-zinc-200 disabled:opacity-40 dark:text-zinc-300 dark:enabled:hover:bg-zinc-700"
        >
          <i className="fa-solid fa-rotate-left" />
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 enabled:hover:bg-zinc-200 disabled:opacity-40 dark:text-zinc-300 dark:enabled:hover:bg-zinc-700"
        >
          <i className="fa-solid fa-rotate-right" />
          Redo
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {index + 1} / {entries.length}
          </span>
          <button
            onClick={clear}
            className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <i className="fa-solid fa-trash" />
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {entries
          .map((entry, i) => (
            <button
              key={i}
              onClick={() => travelTo(i)}
              className={clsx(
                'flex w-full flex-col gap-0.5 border-b border-zinc-100 px-3 py-1.5 text-left font-mono text-xs dark:border-zinc-800',
                {
                  'bg-violet-600 text-white dark:bg-violet-600': i === index,
                  'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60': i !== index,
                  'opacity-50': i > index
                }
              )}
            >
              <div className="flex w-full items-center gap-2">
                <span className="grow truncate">
                  {entry.path ?? <span className="italic opacity-70">{i === 0 ? 'initial state' : 'replace'}</span>}
                </span>
                <span className="shrink-0 text-[10px] opacity-70">{formatTime(entry.timestamp)}</span>
              </div>
              {entry.value !== undefined && (
                <span className="w-full truncate text-[10px] opacity-70">{previewValue(entry.value)}</span>
              )}
            </button>
          ))
          .reverse()}
      </div>
    </div>
  );
};

export default HistoryViewer;
