import CodeBlock from '../../../CodeBlock';

const ReactGuide = () => (
  <>
    <h2>React</h2>
    <p>
      React bindings live in <code>@plitzi/nexus/react</code>. Bind typed hooks once with{' '}
      <code>createStoreHook</code>, wrap your tree with <code>StoreProvider</code>, then read and write by path.
    </p>
    <CodeBlock language="bash" code={`npm install @plitzi/nexus   # peer: react@^18 || ^19`} />

    <CodeBlock
      code={`// store.ts
import { createStoreHook } from '@plitzi/nexus/react';

type AppState = { count: number; user: { name: string } };

export const { useStore, useStoreGetter, useStoreSetter } = createStoreHook<AppState>();`}
    />
    <CodeBlock
      code={`// App.tsx
import { StoreProvider } from '@plitzi/nexus/react';

import { useStore } from './store';

function Counter() {
  const [count, setCount] = useStore('count'); // re-renders only when 'count' changes

  return <button onClick={() => setCount(n => n + 1)}>count is {count}</button>;
}

export default function App() {
  return (
    <StoreProvider value={{ count: 0, user: { name: 'Ada' } }}>
      <Counter />
    </StoreProvider>
  );
}`}
    />
    <p>
      Other React entries: <code>useStoreHistory</code> (undo/redo), <code>useEntity</code> /{' '}
      <code>useEntityOne</code> (entity stores), <code>useDerived</code>, <code>useAsync</code>.
    </p>
  </>
);

export default ReactGuide;
