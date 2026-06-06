import { resetPersist, usePersistStore } from '../../persistStore';

const PersistBody = () => {
  const [clicks, setClicks] = usePersistStore('clicks');
  const [note, setNote] = usePersistStore('note');

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        Click, type, then <strong className="text-zinc-300">reload the page</strong> — the values are still here. The
        store mirrors itself to <code className="font-mono text-brand-300">localStorage</code> and rehydrates on load.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setClicks(n => n + 1)}
          className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-brand-500 hover:text-white"
        >
          clicks +1
        </button>
        <span className="font-mono text-sm text-brand-300">{clicks}</span>
        <button onClick={resetPersist} className="ml-auto text-xs text-zinc-600 transition hover:text-red-400">
          reset
        </button>
      </div>

      <input
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder="A note that survives reloads…"
        className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-500"
      />
    </div>
  );
};

export default PersistBody;
