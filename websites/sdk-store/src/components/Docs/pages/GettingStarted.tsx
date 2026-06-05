import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const GettingStarted = () => (
  <Prose>
    <p>
      <code>@plitzi/sdk-store</code> is a type-safe React store built on <code>useSyncExternalStore</code>. You
      subscribe to <strong>dot-notation paths</strong> and a component re-renders only when that exact value changes —
      no selectors, no reducers, no action types. This page takes you from install to a working counter.
    </p>

    <h2>Install</h2>
    <CodeBlock language="bash" code={`npm install @plitzi/sdk-store\n# or: yarn add @plitzi/sdk-store`} />
    <p>Peer dependency: React 18 or 19. The package is ESM, tree-shakeable, and SSR-safe.</p>

    <h2>1. Describe your state</h2>
    <p>Your state is a plain object. Paths are derived from its type, so everything stays autocompleted and checked.</p>
    <CodeBlock
      code={`type AppState = {
  count: number;
  user: { name: string };
};

const initialState: AppState = {
  count: 0,
  user: { name: 'Ada' }
};`}
    />

    <h2>2. Bind hooks once with createStoreHook</h2>
    <p>
      Call <code>createStoreHook&lt;AppState&gt;()</code> at module level so every hook is fully typed without repeating
      the generic at each call site.
    </p>
    <CodeBlock
      code={`// store.ts
import { createStoreHook } from '@plitzi/sdk-store';

export const { useStore, useStoreSync, useStoreGetter, useStoreSetter } =
  createStoreHook<AppState>();`}
    />

    <h2>3. Wrap your tree with StoreProvider</h2>
    <p>
      The provider creates the store from an initial value and hands it down via context. (You can also create a store
      yourself with <code>createStore</code> and pass it as <code>store=&#123;...&#125;</code>.)
    </p>
    <CodeBlock
      code={`import { StoreProvider } from '@plitzi/sdk-store';

function Root() {
  return (
    <StoreProvider value={initialState}>
      <Counter />
      <Profile />
    </StoreProvider>
  );
}`}
    />

    <h2>4. Read and write by path</h2>
    <p>
      <code>useStore('path')</code> returns a <code>[value, setValue]</code> tuple, just like <code>useState</code> —
      but it only re-renders when that path changes. A sibling write never wakes it.
    </p>
    <CodeBlock
      code={`import { useStore } from './store';

function Counter() {
  const [count, setCount] = useStore('count');

  return (
    <button onClick={() => setCount(n => n + 1)}>
      count is {count}
    </button>
  );
}

function Profile() {
  // Re-renders only when user.name changes — never when count does.
  const [name, setName] = useStore('user.name');

  return <input value={name} onChange={e => setName(e.target.value)} />;
}`}
    />

    <p>
      That’s a complete app. No store instance to thread around, no actions, no selectors — the path <em>is</em> the
      selector, and it’s checked against <code>AppState</code>.
    </p>

    <h2>Without React</h2>
    <p>
      The store is a plain object you can use anywhere. <code>createStore</code> returns the imperative API.
    </p>
    <CodeBlock
      code={`import { createStore } from '@plitzi/sdk-store';

const store = createStore<AppState>(initialState);

store.getState();                    // whole state
store.getPath('user.name');          // single path, no merge
store.setState('count', 1);          // typed write
store.setState('count', n => n + 1); // updater
const off = store.subscribePath('count', () => render());`}
    />

    <h2>Next steps</h2>
    <ul>
      <li>
        <a href="#/docs/api">API reference</a> — every function and its signatures.
      </li>
      <li>
        <a href="#/docs/guides-forms">Patterns: Forms</a> — controlled fields, validation, dynamic arrays, dirty detection.
      </li>
      <li>
        <a href="#/docs/guides-data-fetching">Patterns: Data Fetching</a> — async resources, race conditions, mutations.
      </li>
      <li>
        <a href="#/docs/guides-nextjs">Patterns: Next.js</a> — App Router, server hydration, cookies, Server Actions.
      </li>
      <li>
        <a href="#/docs/testing">Testing</a> — how to test stores, hooks and components.
      </li>
      <li>
        <a href="#/docs/migration">Migration</a> — coming from Zustand, Redux, Jotai or Valtio.
      </li>
      <li>
        <a href="#/docs/faq">FAQ &amp; troubleshooting</a> — “why isn’t my component re-rendering?” and friends.
      </li>
      <li>
        <a href="#demo">Live demos</a> on the landing page — scoped stores, derived values, middleware, time-travel.
      </li>
    </ul>
  </Prose>
);

export default GettingStarted;
