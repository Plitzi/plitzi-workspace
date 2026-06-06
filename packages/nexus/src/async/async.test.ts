import { describe, it, expect } from 'vitest';

import { createAsync } from './createAsync';
import createStore from '../createStore/createStore';

type State = { value: number; label: string };
const initial = (): State => ({ value: 0, label: 'idle' });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('createAsync', () => {
  it('starts idle and exposes no in-flight promise', () => {
    const store = createStore<State>(initial());
    const resource = createAsync(store, 'value', (n: number) => Promise.resolve(n * 2));

    expect(resource.get()).toEqual({ status: 'idle', data: 0, error: undefined, isLoading: false });
    expect(resource.suspend()).toBeUndefined();
  });

  it('resolves, writes the result to the store path, and reports success', async () => {
    const store = createStore<State>(initial());
    const resource = createAsync(store, 'value', (n: number) => Promise.resolve(n * 2));

    const result = await resource.run(21);

    expect(result).toBe(42);
    expect(store.getState().value).toBe(42);
    expect(resource.get()).toEqual({ status: 'success', data: 42, error: undefined, isLoading: false });
  });

  it('goes pending while in flight and back once settled', async () => {
    const store = createStore<State>(initial());
    const gate = deferred<number>();
    const resource = createAsync(store, 'value', () => gate.promise);

    const run = resource.run();
    await Promise.resolve();

    expect(resource.get().status).toBe('pending');
    expect(resource.get().isLoading).toBe(true);
    expect(resource.suspend()).toBeInstanceOf(Promise);

    gate.resolve(7);
    await run;

    expect(resource.get().status).toBe('success');
    expect(resource.suspend()).toBeUndefined();
  });

  it('records the error and keeps the previous store value on failure', async () => {
    const store = createStore<State>(initial());
    const failure = new Error('nope');
    const resource = createAsync(store, 'value', () => Promise.reject(failure));

    await expect(resource.run()).rejects.toThrow('nope');

    expect(store.getState().value).toBe(0);
    expect(resource.get()).toMatchObject({ status: 'error', error: failure });
  });

  it('keeps the latest run when an earlier request resolves after a newer one', async () => {
    const store = createStore<State>(initial());
    const first = deferred<number>();
    const second = deferred<number>();
    const gates = [first, second];
    let call = 0;
    const resource = createAsync(store, 'value', () => gates[call++].promise);

    const run1 = resource.run();
    const run2 = resource.run();

    second.resolve(20);
    await run2;
    first.resolve(10);
    await run1;

    expect(store.getState().value).toBe(20);
    expect(resource.get().status).toBe('success');
  });

  it('runs immediately when given immediate args', async () => {
    const store = createStore<State>(initial());
    const resource = createAsync(store, 'value', (n: number) => Promise.resolve(n + 1), { immediate: [99] });

    expect(resource.get().status).toBe('pending');

    await resource.suspend();

    expect(store.getState().value).toBe(100);
  });

  it('reflects an external write to the path through its subscription', () => {
    const store = createStore<State>(initial());
    const resource = createAsync(store, 'value', (n: number) => Promise.resolve(n));
    let notifications = 0;
    resource.subscribe(() => notifications++);

    store.setState('value', 5);

    expect(notifications).toBe(1);
    expect(resource.get().data).toBe(5);
  });

  it('stops reacting after destroy', () => {
    const store = createStore<State>(initial());
    const resource = createAsync(store, 'value', (n: number) => Promise.resolve(n));
    let notifications = 0;
    resource.subscribe(() => notifications++);

    resource.destroy();
    store.setState('value', 5);

    expect(notifications).toBe(0);
  });

  it('latest-call-wins: a failing latest run suppresses an earlier success (design intent)', async () => {
    const store = createStore<State>(initial());
    const first = deferred<number>();
    const second = deferred<number>();
    const gates = [first, second];
    let call = 0;
    const resource = createAsync(store, 'value', () => gates[call++].promise);

    const run1 = resource.run(); // slow, will succeed
    const run2 = resource.run(); // fast, will fail

    second.reject(new Error('second failed'));
    await expect(run2).rejects.toThrow('second failed');

    // At this point run2 has failed. Now resolve run1 — the older request.
    first.resolve(42);
    await run1;

    // "The latest call wins": run2 was called second, so its error state persists.
    // The earlier run1's success is ignored even though it resolved after run2.
    expect(store.getState().value).toBe(0);
    expect(resource.get().status).toBe('error');
  });
});
