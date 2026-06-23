import { createStoreHook } from '@plitzi/nexus/react';

import { freshBoard } from './game2048Logic';

// 2048 keeps its board, score and move count in a dedicated store with `historyMiddleware`, so every committed move
// becomes a time-travel snapshot. One write per move (the whole `game` object) means one clean history entry —
// perfect for the undo / redo / scrub bar.
export type Game2048State = {
  game: {
    board: number[];
    score: number;
    moves: number;
  };
};

export const make2048Initial = (): Game2048State => ({
  game: { board: freshBoard(), score: 0, moves: 0 }
});

export const { useStore: use2048, useStoreSetter: use2048Setter } = createStoreHook<Game2048State>();
