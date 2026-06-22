import CodeBlock from '../../../CodeBlock';

const AstroGuide = () => (
  <>
    <h2>Astro (6 LTS &amp; 7)</h2>
    <p>
      Astro renders each <code>client:*</code> component as an independent React root (an island). React Context does
      not cross island boundaries, so pick the pattern by scope.
    </p>
    <CodeBlock language="bash" code={`npm install @plitzi/nexus   # with @astrojs/react`} />

    <p>
      <strong>Island-local state</strong> — the ordinary Provider pattern, scoped to one island:
    </p>
    <CodeBlock
      code={`// Counter.tsx
import { StoreProvider, createStoreHook } from '@plitzi/nexus/react';

const { useStore } = createStoreHook<{ count: number }>();

function Inner() {
  const [count, setCount] = useStore('count');
  return <button onClick={() => setCount(n => n + 1)}>{count}</button>;
}

export default () => (
  <StoreProvider value={{ count: 0 }}>
    <Inner />
  </StoreProvider>
);`}
    />
    <p>
      <strong>Cross-island state</strong> — a module singleton every island imports (no Provider):
    </p>
    <CodeBlock
      code={`// store.ts
import { createStore } from '@plitzi/nexus';
export const appStore = createStore(() => ({ count: 0 }));

// SharedCounter.tsx
import { useStore } from '@plitzi/nexus/react';
import { appStore } from './store';

export default function SharedCounter() {
  const [count, setCount] = useStore('count', { store: appStore });
  return <button onClick={() => setCount(n => n + 1)}>{count}</button>;
}`}
    />
  </>
);

export default AstroGuide;
