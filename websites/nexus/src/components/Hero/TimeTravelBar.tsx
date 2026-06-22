import { useStoreHistory } from '@plitzi/nexus/react';

import { type Game2048State } from './game2048Store';
import { sfx } from './heroSfx';

// The whole point of the 2048 panel: every move is a recorded snapshot, so you can step back through the game's
// entire history or scrub straight to any point — powered by `historyMiddleware` + `useStoreHistory`.
const TimeTravelBar = () => {
  const { entries, index, canUndo, canRedo, undo, redo, travelTo } = useStoreHistory<Game2048State>();
  const last = Math.max(0, entries.length - 1);

  return (
    <div className="border-ink-700/70 bg-ink-950/70 mt-4 rounded-xl border p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase">time-travel</span>
        <span className="ml-auto font-mono text-[10px] text-zinc-500">
          snapshot {Math.max(0, index) + 1}/{entries.length || 1}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => {
            undo();
            sfx.undo();
          }}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white rounded-lg border px-3 py-1.5 font-mono text-xs text-zinc-300 transition disabled:opacity-30"
        >
          ◀ undo
        </button>

        <input
          type="range"
          min={0}
          max={last}
          value={Math.max(0, index)}
          onChange={e => travelTo(Number(e.target.value))}
          className="accent-brand-500 h-1 flex-1 cursor-pointer"
          aria-label="Scrub through history"
        />

        <button
          type="button"
          disabled={!canRedo}
          onClick={() => {
            redo();
            sfx.undo();
          }}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white rounded-lg border px-3 py-1.5 font-mono text-xs text-zinc-300 transition disabled:opacity-30"
        >
          redo ▶
        </button>
      </div>
    </div>
  );
};

export default TimeTravelBar;
