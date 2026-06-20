import { createStore, createStoreHook, loggerMiddleware } from '@plitzi/nexus';

import { pushLog } from './heroLog';

// Tic-tac-toe in a dedicated store. Its showcase is `createDerived`: the winner is a single memoized value computed
// from the `board` path — defined once, read anywhere, recomputed only when the board changes.
export type TTTState = {
  board: number[];
  turn: number;
};

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

// 0 = still playing, 1 = X (you), 2 = O (AI), 3 = draw.
export const computeWinner = (board: number[]): number => {
  for (const [a, b, c] of LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return board.every(v => v !== 0) ? 3 : 0;
};

// The three cells of the winning line, for highlighting — or null while there's no winner.
export const winningLine = (board: number[]): number[] | null => {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }

  return null;
};

const wouldWin = (board: number[], i: number, player: number): boolean => {
  const next = board.slice();
  next[i] = player;

  return computeWinner(next) === player;
};

// Heuristic AI (O): take a win, block your win, else centre, corner, edge.
export const aiMove = (board: number[]): number => {
  const empties = board.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
  for (const i of empties) {
    if (wouldWin(board, i, 2)) {
      return i;
    }
  }

  for (const i of empties) {
    if (wouldWin(board, i, 1)) {
      return i;
    }
  }

  if (board[4] === 0) {
    return 4;
  }

  for (const c of [0, 2, 6, 8]) {
    if (board[c] === 0) {
      return c;
    }
  }

  return empties[0];
};

export const freshTTT = (): TTTState => ({ board: new Array(9).fill(0), turn: 1 });

export const createTTTStore = () =>
  createStore<TTTState>(freshTTT(), {
    middlewares: [loggerMiddleware<TTTState>(change => pushLog(change.path ?? '(root)', change.next))]
  });

export const { useStore: useTTT, useStoreSetter: useTTTSetter } = createStoreHook<TTTState>();
