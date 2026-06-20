import { StoreProvider, historyMiddleware, loggerMiddleware } from '@plitzi/nexus';
import { useState } from 'react';

import Board2048 from './Board2048';
import { type Game2048State, make2048Initial } from './game2048Store';
import { pushLog } from './heroLog';

// A self-contained store with its own history + logger. It feeds the same on-screen log panel (shared sink), but keeps
// its time-travel timeline separate from the real-time games.
const MIDDLEWARES = [
  historyMiddleware<Game2048State>(),
  loggerMiddleware<Game2048State>(change => pushLog(change.path ?? '(root)', change.next))
];

const Game2048 = () => {
  const [initial] = useState(make2048Initial);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <StoreProvider value={initial} middlewares={MIDDLEWARES}>
        <Board2048 />
      </StoreProvider>
    </div>
  );
};

export default Game2048;
