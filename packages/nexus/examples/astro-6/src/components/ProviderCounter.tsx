// A self-contained island: everything lives inside one React tree, so the classic Provider + hooks pattern works
// exactly as in a plain React app. Use this when an island owns its own local state and nothing outside needs it.
import { StoreProvider, createStoreHook } from '@plitzi/nexus/react';

type LocalState = { count: number };

const { useStore } = createStoreHook<LocalState>();

function Counter() {
  const [count, setCount] = useStore('count');

  return <button onClick={() => setCount(n => n + 1)}>local: {count}</button>;
}

export default function ProviderCounter() {
  return (
    <StoreProvider value={{ count: 0 }}>
      <Counter />
    </StoreProvider>
  );
}
