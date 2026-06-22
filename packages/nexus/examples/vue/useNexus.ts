// Vue has no dedicated Nexus integration yet — and it doesn't need one. The agnostic core exposes `subscribe` +
// `getState`, which is all a `ref` needs. This composable is the proof that `@plitzi/nexus` carries zero React.
import { onUnmounted, ref } from 'vue';

import type { StoreApi } from '@plitzi/nexus';

export function useNexus<TState extends object, V>(store: StoreApi<TState>, select: (state: TState) => V) {
  const value = ref(select(store.getState()));
  const unsubscribe = store.subscribe(() => {
    value.value = select(store.getState());
  });

  onUnmounted(unsubscribe);

  return value;
}
