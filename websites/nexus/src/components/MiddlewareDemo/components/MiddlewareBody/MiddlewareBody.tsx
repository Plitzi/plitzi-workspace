import { useCallback } from 'react';

import { useStoreHistory } from '@plitzi/nexus';

import { PERSIST_KEY, useMwStore } from '../../middlewareStore';

import type { LogEntry, MiddlewareState } from '../../middlewareStore';
import type { ChangeEvent } from 'react';

const MiddlewareBody = ({ log }: { log: LogEntry[] }) => {
  const [count, setCount] = useMwStore('count');
  const [name, setName] = useMwStore('user.name');
  const { canUndo, canRedo, undo, redo } = useStoreHistory<MiddlewareState>();

  const handleName = useCallback((event: ChangeEvent<HTMLInputElement>) => setName(event.target.value), [setName]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-14 text-xs uppercase tracking-wide text-zinc-500">count</span>
          <button
            onClick={() => setCount(value => value - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-zinc-300 transition hover:border-brand-500 hover:text-white"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center font-mono text-lg font-bold text-white">{count}</span>
          <button
            onClick={() => setCount(value => value + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-zinc-300 transition hover:border-brand-500 hover:text-white"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-14 text-xs uppercase tracking-wide text-zinc-500">name</span>
          <input
            value={name}
            onChange={handleName}
            className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-brand-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↶ undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-brand-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↷ redo
          </button>
        </div>

        <p className="text-xs leading-relaxed text-zinc-600">
          <span className="text-brand-300">history</span> powers undo/redo · <span className="text-brand-300">persist</span>{' '}
          saves to <code className="text-zinc-400">localStorage['{PERSIST_KEY}']</code> — reload the page and the values
          come back.
        </p>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">logger feed</p>
        {log.length === 0 ? (
          <p className="text-xs text-zinc-600">Mutate state — every committed change shows up here.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {log.map(entry => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span className="text-brand-300">{entry.path}</span>
                <span className="truncate text-zinc-400">{entry.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MiddlewareBody;
