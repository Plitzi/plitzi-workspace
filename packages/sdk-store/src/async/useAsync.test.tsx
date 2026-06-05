import { act, render, screen, waitFor } from '@testing-library/react';
import { Component, Suspense, createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { createAsync } from './createAsync';
import { useAsync } from './useAsync';
import { useAsyncValue } from './useAsyncValue';
import createStore from '../createStore/createStore';

import type { AsyncResource } from './createAsync';
import type { ReactNode } from 'react';

type State = { value: number };
const makeStore = () => createStore<State>({ value: 0 });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return createElement('div', null, `error:${error instanceof Error ? error.message : 'unknown'}`);
    }

    return this.props.children;
  }
}

const StatusView = ({ resource }: { resource: AsyncResource<number, [number]> }) => {
  const { status, data } = useAsync(resource);

  return createElement('div', null, `${status}:${data}`);
};

const ValueView = ({ resource }: { resource: AsyncResource<number, []> }) => {
  const value = useAsyncValue(resource);

  return createElement('div', null, `value:${value}`);
};

describe('useAsync', () => {
  it('renders status reactively as the resource runs', async () => {
    const store = makeStore();
    const resource = createAsync(store, 'value', (n: number) => Promise.resolve(n * 2));

    render(createElement(StatusView, { resource }));
    expect(screen.getByText('idle:0')).toBeTruthy();

    await act(() => resource.run(10));
    expect(screen.getByText('success:20')).toBeTruthy();
  });
});

describe('useAsyncValue', () => {
  it('suspends while pending and renders the value once resolved', async () => {
    const store = makeStore();
    const gate = deferred<number>();
    const resource = createAsync(store, 'value', () => gate.promise, { immediate: [] });

    render(
      createElement(
        Suspense,
        { fallback: createElement('div', null, 'loading') },
        createElement(ValueView, { resource })
      )
    );
    expect(screen.getByText('loading')).toBeTruthy();

    gate.resolve(42);
    await waitFor(() => expect(screen.getByText('value:42')).toBeTruthy());
  });

  it('throws to the nearest error boundary on failure', async () => {
    const store = makeStore();
    const gate = deferred<number>();
    const resource = createAsync(store, 'value', () => gate.promise, { immediate: [] });

    // React logs caught boundary errors to console.error; the failure here is expected, so keep it out of the output.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      createElement(
        Boundary,
        null,
        createElement(
          Suspense,
          { fallback: createElement('div', null, 'loading') },
          createElement(ValueView, { resource })
        )
      )
    );

    gate.reject(new Error('failed'));
    await waitFor(() => expect(screen.getByText('error:failed')).toBeTruthy());

    consoleError.mockRestore();
  });
});
