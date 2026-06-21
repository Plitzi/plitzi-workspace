import { useStoreHistory } from '@plitzi/nexus';
import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef } from 'react';

import { persistKey, purgeSave } from './arcadePersist';
import { type Dir, move, spawn, tileCount, tileStyle } from './game2048Logic';
import { type Game2048State, make2048Initial, use2048, use2048Setter } from './game2048Store';
import { useDebug, useRenderCount } from './heroDebug';
import { sfx } from './heroSfx';
import TimeTravelBar from './TimeTravelBar';

const Stat = ({ label, value }: { label: string; value: number }) => {
  const debug = useDebug();
  const renders = useRenderCount();

  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] tracking-[0.16em] text-zinc-500 uppercase">{label}</span>
      <span key={value} className="stat-pop text-brand-200 font-mono text-lg font-bold tabular-nums">
        {value}
      </span>
      {debug && <span className="font-mono text-[9px] text-emerald-400">{renders} renders</span>}
    </div>
  );
};

const Board2048 = () => {
  const [board] = use2048('game.board');
  const [score] = use2048('game.score');
  const [moves] = use2048('game.moves');
  const set = use2048Setter();
  const { clear } = useStoreHistory<Game2048State>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Per-game purge: wipes only this board's save (and its time-travel log), leaving the other games untouched.
  const clearSave = useCallback(() => {
    purgeSave(persistKey('2048'));
    set('game', make2048Initial().game);
    clear();
    sfx.undo();
  }, [set, clear]);

  // Grab focus on mount so the arrow keys drive the board immediately, without a click first.
  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  // One write per move — the whole `game` object — so the history log gets exactly one snapshot per move.
  const apply = useCallback(
    (dir: Dir) => {
      const res = move(board, dir);
      if (!res.moved) {
        return;
      }

      set('game', { board: spawn(res.board), score: score + res.gained, moves: moves + 1 });
      sfx.move();
    },
    [board, score, moves, set]
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      apply(dir);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!start.current) {
      return;
    }

    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      apply(dx > 0 ? 'right' : 'left');
    } else {
      apply(dy > 0 ? 'down' : 'up');
    }
  };

  return (
    <div className="pointer-events-auto w-full max-w-sm">
      <div className="mb-3 flex items-center gap-6">
        <Stat label="Score" value={score} />
        <Stat label="Moves" value={moves} />
        <Stat label="Tiles" value={tileCount(board)} />
        <button
          type="button"
          onClick={() => set('game', make2048Initial().game)}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 ml-auto rounded-lg border px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:text-white"
        >
          new game
        </button>
        <button
          type="button"
          onClick={clearSave}
          title="Delete this game's save"
          className="border-ink-700 rounded-lg border px-2 py-1.5 font-mono text-[10px] text-zinc-500 transition hover:border-rose-500 hover:text-rose-300"
        >
          clear save
        </button>
      </div>

      <div
        ref={boardRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="border-ink-700/70 focus:border-brand-500 bg-ink-950/60 grid grid-cols-4 gap-2 rounded-2xl border p-2.5 backdrop-blur-md outline-none"
      >
        {board.map((value, i) => (
          <div
            key={i}
            style={tileStyle(value)}
            className={`flex aspect-square items-center justify-center rounded-lg font-mono text-lg font-bold transition-colors ${
              value === 0 ? '' : 'stat-pop'
            }`}
          >
            {value || 0}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => apply('left')}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 rounded-lg border px-3 py-1.5 text-zinc-300 transition"
          aria-label="Move left"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => apply('up')}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 rounded-lg border px-3 py-1.5 text-zinc-300 transition"
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => apply('down')}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 rounded-lg border px-3 py-1.5 text-zinc-300 transition"
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => apply('right')}
          className="border-ink-600 bg-ink-800 hover:border-brand-500 rounded-lg border px-3 py-1.5 text-zinc-300 transition"
          aria-label="Move right"
        >
          →
        </button>
      </div>

      <TimeTravelBar />
    </div>
  );
};

export default Board2048;
