import { useSyncExternalStore } from 'react';

import type { Derived } from '../createDerived';

// Subscribes to a shared `Derived` and re-renders only when its computed value changes. The computation is shared
// across every component using the same derived, not repeated per consumer.
export function useDerived<R>(derived: Derived<R>): R {
  return useSyncExternalStore(derived.subscribe, derived.get, derived.get);
}
