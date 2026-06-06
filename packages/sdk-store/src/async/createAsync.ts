import { createObservable } from '../helpers/createObservable';

import type { PathOf, PathValue, StoreApi } from '../types';

export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';

export type AsyncSnapshot<T> = {
  status: AsyncStatus;
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
};

export type AsyncResource<T, Args extends readonly unknown[]> = {
  // Current status plus the resolved value (read live from the store path). Stable reference between changes so it
  // can back `useSyncExternalStore` directly.
  get: () => AsyncSnapshot<T>;
  // Runs the fetcher and writes its result to the store path on success. The latest call wins: an earlier in-flight
  // request that resolves after a newer one is ignored.
  run: (...args: Args) => Promise<T>;
  subscribe: (listener: () => void) => () => void;
  // The promise to throw for Suspense while pending — it settles (never rejects) when the fetch does, so React just
  // retries the render. `undefined` once settled or before the first run.
  suspend: () => Promise<void> | undefined;
  destroy: () => void;
};

export type AsyncOptions<Args extends readonly unknown[]> = {
  // Fire `run(...immediate)` as soon as the resource is created — the usual setup for Suspense, so a component that
  // reads it suspends on the in-flight request instead of seeing an idle resource.
  immediate?: Args;
};

// Binds an async request to a store path: the resolved value lands in the store (so path subscriptions, derived
// values and persistence all see it), while load status (pending/error) lives here. Pair with `useAsync` for inline
// loading/error UI, or `useAsyncValue` for Suspense.
export function createAsync<TState extends object, P extends PathOf<TState>, Args extends readonly unknown[]>(
  store: StoreApi<TState>,
  path: P,
  fetcher: (...args: Args) => Promise<PathValue<TState, P>>,
  options: AsyncOptions<Args> = {}
): AsyncResource<PathValue<TState, P>, Args> {
  type T = PathValue<TState, P>;

  let status: AsyncStatus = 'idle';
  let error: unknown;
  let current: Promise<T> | undefined;
  let settled: Promise<void> | undefined;

  // The snapshot is rebuilt only when invalidated (a status change or a store write to the path), so `get` returns a
  // stable reference between changes and can back `useSyncExternalStore` directly.
  const observable = createObservable<AsyncSnapshot<T>>(() => ({
    status,
    data: store.getPath(path),
    error,
    isLoading: status === 'pending'
  }));

  const emit = (): void => {
    observable.invalidate();
    observable.notify();
  };

  const get = observable.get;

  const run = (...args: Args): Promise<T> => {
    status = 'pending';
    error = undefined;

    const promise = Promise.resolve().then(() => fetcher(...args));
    current = promise;
    settled = promise.then(
      () => undefined,
      () => undefined
    );
    emit();

    return promise.then(
      data => {
        if (promise === current) {
          current = undefined;
          settled = undefined;
          status = 'success';
          store.setState(path, data);
          emit();
        }

        return data;
      },
      (caught: unknown) => {
        if (promise === current) {
          current = undefined;
          settled = undefined;
          status = 'error';
          error = caught;
          emit();
        }

        throw caught;
      }
    );
  };

  const unsubscribePath = store.subscribePath(path, emit);

  if (options.immediate) {
    // We own this auto-run, so swallow its rejection here — the failure is still surfaced through `status: 'error'`
    // (and re-thrown by `useAsyncValue`). A caller-initiated `run()` keeps its rejection for the caller to handle.
    run(...options.immediate).catch(() => undefined);
  }

  return {
    get,
    run,
    subscribe: observable.subscribe,
    suspend: () => settled,
    destroy: () => {
      unsubscribePath();
      observable.destroy();
    }
  };
}
