import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const Testing = () => (
  <Prose>
    <p>
      Because a store is just a plain object with <code>getState</code> / <code>setState</code> / <code>subscribe</code>
      , most logic can be tested without React at all. For components and hooks, render them inside a{' '}
      <code>StoreProvider</code>. Examples use <a href="https://vitest.dev">Vitest</a> +{' '}
      <a href="https://testing-library.com/docs/react-testing-library/intro/">React Testing Library</a>, but the
      patterns are framework-agnostic.
    </p>

    <h2>Testing a store directly</h2>
    <p>No render, no provider — drive the store and assert on state or on what subscribers saw.</p>
    <CodeBlock
      language="ts"
      code={`import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@plitzi/sdk-store';

type State = { count: number; user: { name: string } };
const initial = (): State => ({ count: 0, user: { name: 'Ada' } });

it('writes a path and notifies only that path', () => {
  const store = createStore<State>(initial());
  const onCount = vi.fn();
  store.subscribePath('count', onCount);

  store.setState('count', 1);
  store.setState('user.name', 'Bob'); // unrelated path

  expect(store.getState().count).toBe(1);
  expect(onCount).toHaveBeenCalledTimes(1); // not woken by user.name
});`}
    />

    <h2>Testing a component</h2>
    <p>
      Wrap the component in a <code>StoreProvider</code>. Pass <code>autoSync=&#123;false&#125;</code> in tests so the
      provider doesn’t re-sync the initial value on every render and clobber your writes.
    </p>
    <CodeBlock
      code={`import { render, screen, fireEvent } from '@testing-library/react';
import { StoreProvider } from '@plitzi/sdk-store';
import { useStore } from './store'; // createStoreHook<State>()

function Counter() {
  const [count, setCount] = useStore('count');
  return <button onClick={() => setCount(n => n + 1)}>count {count}</button>;
}

it('increments on click', () => {
  render(
    <StoreProvider value={{ count: 0, user: { name: 'Ada' } }} autoSync={false}>
      <Counter />
    </StoreProvider>
  );

  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('count 1')).toBeInTheDocument();
});`}
    />

    <h2>Testing a hook</h2>
    <p>
      Use <code>renderHook</code> with a wrapper that supplies the provider. Drive the store from outside the hook and
      assert the hook re-rendered.
    </p>
    <CodeBlock
      code={`import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { createStore, StoreProvider } from '@plitzi/sdk-store';
import { useStore } from './store';

it('re-renders when its path changes', () => {
  const store = createStore<State>({ count: 0, user: { name: 'Ada' } });
  const wrapper = ({ children }) =>
    createElement(StoreProvider, { store }, children);

  const { result } = renderHook(() => useStore('count'), { wrapper });

  act(() => store.setState('count', 5));
  expect(result.current[0]).toBe(5);
});`}
    />

    <h2>Testing your own middleware</h2>
    <p>
      A middleware is a function — attach it to a store and assert on its effects. For an interceptor, assert that the
      committed value was transformed or that a write was blocked.
    </p>
    <CodeBlock
      language="ts"
      code={`import { createStore, CANCEL } from '@plitzi/sdk-store';

const clamp = () => ({
  beforeChange: ({ path, value }) =>
    path === 'count' ? Math.min(value as number, 10) : undefined
});

it('clamps before commit', () => {
  const store = createStore<State>(initial(), { middlewares: [clamp] });
  store.setState('count', 999);
  expect(store.getState().count).toBe(10);
});`}
    />

    <h2>Testing time-travel</h2>
    <p>
      Add <code>historyMiddleware()</code>, then read the handle with <code>getStoreHistory</code> (it returns{' '}
      <code>undefined</code> when the middleware is absent).
    </p>
    <CodeBlock
      language="ts"
      code={`import { createStore, historyMiddleware, getStoreHistory } from '@plitzi/sdk-store';

it('undo restores the previous state', () => {
  const store = createStore<State>(initial(), { middlewares: [historyMiddleware()] });
  store.setState('count', 1);
  store.setState('count', 2);

  const history = getStoreHistory(store);
  history?.undo();
  expect(store.getState().count).toBe(1);
});`}
    />

    <h2>Setup notes</h2>
    <ul>
      <li>
        Component/hook tests need a DOM — set Vitest’s <code>environment: 'jsdom'</code> (or <code>happy-dom</code>).
      </li>
      <li>
        Pure store/middleware tests run in the default <code>node</code> environment — no DOM required.
      </li>
      <li>
        Prefer <code>subscribePath</code> assertions over render counts to prove “only the right path woke.”
      </li>
      <li>
        For the Redux DevTools middleware, stub <code>window.__REDUX_DEVTOOLS_EXTENSION__</code> with a fake{' '}
        <code>connect()</code> and assert on the captured <code>send</code> calls.
      </li>
    </ul>
  </Prose>
);

export default Testing;
