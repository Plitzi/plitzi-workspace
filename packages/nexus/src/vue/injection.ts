import { inject, provide } from 'vue';

import type { StoreApi } from '../types';
import type { InjectionKey } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StoreKey: InjectionKey<StoreApi<any>> = Symbol('@plitzi/nexus/vue/store');

// Provides a store to descendant components — the Vue equivalent of React's `<StoreProvider>`. Call it in a parent
// component's `setup`; children then read it with `useStore` / `useStoreValue` (no explicit `{ store }` needed).
export function provideStore<TState extends object>(store: StoreApi<TState>): void {
  provide(StoreKey, store);
}

// Resolves the provided store. Throws if none was provided and no explicit store is passed to the composable.
export function injectStore<TState extends object>(): StoreApi<TState> {
  const store = inject(StoreKey);
  if (!store) {
    throw new Error(
      '@plitzi/nexus/vue: no store provided. Call provideStore(store) in a parent component, or pass { store } to the composable.'
    );
  }

  return store as StoreApi<TState>;
}
