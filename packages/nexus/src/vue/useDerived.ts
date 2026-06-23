import { onScopeDispose, shallowRef } from 'vue';

import type { Derived } from '../derived/createDerived';
import type { Ref } from 'vue';

// Reactive view of a shared `createDerived` value: updates only when the computed result changes.
export function useDerived<R>(derived: Derived<R>): Ref<R> {
  const value = shallowRef(derived.get()) as Ref<R>;
  onScopeDispose(
    derived.subscribe(() => {
      value.value = derived.get();
    })
  );

  return value;
}
