// Adapts a Nexus core store to Svelte's store contract (`{ subscribe }`), so `$myStore` just works in a component.
// Imports only `@plitzi/nexus` — no React anywhere.
import type { StoreApi } from '@plitzi/nexus';

export function nexusStore<TState extends object, V>(store: StoreApi<TState>, select: (state: TState) => V) {
  return {
    subscribe(run: (value: V) => void) {
      run(select(store.getState()));

      return store.subscribe(() => run(select(store.getState())));
    }
  };
}
