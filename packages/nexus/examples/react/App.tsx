import { StoreProvider, useStoreHistory } from '@plitzi/nexus/react';
import { historyMiddleware, persistMiddleware } from '@plitzi/nexus';

import { useStore } from './store';

import type { AppState } from './store';

const Counter = () => {
  const [count, setCount] = useStore('count');
  const { undo, redo, canUndo, canRedo } = useStoreHistory<AppState>();

  return (
    <div>
      <button onClick={() => setCount(n => n - 1)}>-</button>
      <span> {count} </span>
      <button onClick={() => setCount(n => n + 1)}>+</button>
      <button disabled={!canUndo} onClick={undo}>
        undo
      </button>
      <button disabled={!canRedo} onClick={redo}>
        redo
      </button>
    </div>
  );
};

const App = () => (
  <StoreProvider
    value={{ count: 0, user: { name: 'Ada' } }}
    middlewares={[persistMiddleware({ key: 'demo' }), historyMiddleware()]}
  >
    <Counter />
  </StoreProvider>
);

export default App;
