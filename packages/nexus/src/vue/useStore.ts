import { computed, onScopeDispose, shallowRef } from 'vue';

import { injectStore } from './injection';

import type { PathOf, PathValue, StoreApi } from '../types';
import type { Ref, WritableComputedRef } from 'vue';

export type UseStoreOptions<TState extends object> = { store?: StoreApi<TState> };

// Internal: a `shallowRef` kept in sync with a store path (or the whole state when `path` is `undefined`). Cleans up
// its subscription when the owning effect scope is disposed (component unmount).
function trackedRef<TState extends object>(store: StoreApi<TState>, path: PathOf<TState> | undefined): Ref<unknown> {
  const read = () => (path === undefined ? store.getState() : store.getPath(path));
  const value = shallowRef(read());
  const stop =
    path === undefined
      ? store.subscribe(() => {
          value.value = read();
        })
      : store.subscribePath(path, () => {
          value.value = read();
        });
  onScopeDispose(stop);

  return value;
}

// Read-only reactive view of the whole state.
export function useStoreValue<TState extends object>(options?: UseStoreOptions<TState>): Ref<TState>;
// Read-only reactive view of a single path.
export function useStoreValue<TState extends object, P extends PathOf<TState>>(
  path: P,
  options?: UseStoreOptions<TState>
): Ref<PathValue<TState, P> | undefined>;
export function useStoreValue<TState extends object>(
  pathOrOptions?: PathOf<TState> | UseStoreOptions<TState>,
  maybeOptions?: UseStoreOptions<TState>
): Ref<unknown> {
  const hasPath = typeof pathOrOptions === 'string';
  const path = hasPath ? pathOrOptions : undefined;
  const options = (hasPath ? maybeOptions : pathOrOptions) ?? {};
  const store = options.store ?? injectStore<TState>();

  return trackedRef(store, path);
}

// Two-way reactive binding to a store path: read with `ref.value`, write with `ref.value = …` (or `v-model`).
export function useStore<TState extends object, P extends PathOf<TState>>(
  path: P,
  options?: UseStoreOptions<TState>
): WritableComputedRef<PathValue<TState, P> | undefined> {
  const store = options?.store ?? injectStore<TState>();
  const value = useStoreValue<TState, P>(path, { store });

  return computed({
    get: () => value.value,
    set: next => store.set(path, next as PathValue<TState, P>)
  });
}

// Typed factory mirroring React's `createStoreHook<State>()`: returns composables already bound to `TState` so call
// sites don't repeat the generic.
export function createStoreComposable<TState extends object>() {
  return {
    useStore: <P extends PathOf<TState>>(path: P, options?: UseStoreOptions<TState>) =>
      useStore<TState, P>(path, options),
    useStoreValue: <P extends PathOf<TState>>(path: P, options?: UseStoreOptions<TState>) =>
      useStoreValue<TState, P>(path, options),
    useStoreState: (options?: UseStoreOptions<TState>) => useStoreValue<TState>(options)
  };
}
