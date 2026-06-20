import { type Derived, StoreProvider, createDerived, useDerived } from '@plitzi/nexus';
import { useEffect, useMemo, useState } from 'react';

import { useDebug, useRenderCount } from './heroDebug';
import { sfx } from './heroSfx';
import {
  type TTTState,
  aiMove,
  computeWinner,
  createTTTStore,
  freshTTT,
  useTTT,
  useTTTSetter,
  winningLine
} from './ticTacToeStore';

const MARKS = ['', '×', '○'];

const Status = ({ derived }: { derived: Derived<number> }) => {
  // `winner` is the derived value — recomputed only when the board changes, shared with whoever reads it.
  const winner = useDerived(derived);
  const [turn] = useTTT('turn');
  const debug = useDebug();
  const renders = useRenderCount();

  let text = 'Your move';
  if (winner === 1) {
    text = 'You win ✨';
  } else if (winner === 2) {
    text = 'AI wins';
  } else if (winner === 3) {
    text = 'Draw';
  } else if (turn === 2) {
    text = 'AI thinking…';
  }

  return (
    <div className="mb-3 flex flex-col gap-0.5">
      <div className="flex h-7 items-center gap-2">
        <span className="text-brand-200 font-mono text-lg font-bold whitespace-nowrap">{text}</span>
        {debug && <span className="font-mono text-[9px] text-emerald-400">{renders} renders</span>}
      </div>
      <code className="text-[10px] whitespace-nowrap text-zinc-500">winner = useDerived(boardStatus)</code>
    </div>
  );
};

const Board = () => {
  const [board] = useTTT('board');
  const [turn] = useTTT('turn');
  const set = useTTTSetter();
  const winner = computeWinner(board);
  const line = winningLine(board);
  const over = winner !== 0;

  const play = (i: number) => {
    if (board[i] !== 0 || turn !== 1 || winner !== 0) {
      return;
    }

    const afterPlayer = board.slice();
    afterPlayer[i] = 1;
    set(undefined, { board: afterPlayer, turn: 2 });
    sfx.bounce();
    if (computeWinner(afterPlayer) !== 0) {
      return;
    }

    // Brief "thinking" pause, then the AI replies. `afterPlayer` is captured, so no stale-state read is needed.
    window.setTimeout(() => {
      const next = afterPlayer.slice();
      next[aiMove(afterPlayer)] = 2;
      set(undefined, { board: next, turn: 1 });
      sfx.hit();
    }, 450);
  };

  return (
    <div className="pointer-events-auto w-full max-w-xs">
      <div className="border-ink-700/70 bg-ink-950/60 grid grid-cols-3 gap-2 rounded-2xl border p-2.5 backdrop-blur-md">
        {board.map((value, i) => (
          <button
            key={i}
            type="button"
            onClick={() => play(i)}
            className={`flex aspect-square items-center justify-center rounded-lg border font-mono text-3xl font-bold transition ${
              value === 1 ? 'text-brand-300' : value === 2 ? 'text-cyan-300' : 'text-zinc-600'
            } ${value === 0 && turn === 1 && !over ? 'border-ink-700 bg-ink-800/40 hover:border-brand-500' : 'border-transparent bg-ink-800/40'} ${
              line?.includes(i) ? 'tile-win border-brand-500' : ''
            }`}
          >
            {MARKS[value]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => set(undefined, freshTTT())}
        className={`border-ink-600 bg-ink-800 hover:border-brand-500 hover:text-white mt-3 w-full rounded-lg border py-2 font-mono text-xs text-zinc-300 transition ${
          over ? 'attention border-brand-500 text-white' : ''
        }`}
      >
        new game
      </button>
    </div>
  );
};

const TicTacToe = () => {
  const [store] = useState(createTTTStore);
  const status = useMemo(
    () => createDerived<TTTState, ['board'], number>(store, ['board'], ([board]) => computeWinner(board)),
    [store]
  );
  useEffect(() => () => status.destroy(), [status]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <StoreProvider store={store}>
        <div className="w-full max-w-xs">
          <Status derived={status} />
          <Board />
        </div>
      </StoreProvider>
    </div>
  );
};

export default TicTacToe;
