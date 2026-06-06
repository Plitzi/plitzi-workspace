import { useSyncExternalStore } from 'react';

import type { AsyncResource, AsyncSnapshot } from '../createAsync';

// Reactive status of an async resource for inline loading/error UI: re-renders on status changes and when the
// resolved value at the store path changes. The fetch itself is shared across every consumer of the resource.
export function useAsync<T, Args extends readonly unknown[]>(resource: AsyncResource<T, Args>): AsyncSnapshot<T> {
  return useSyncExternalStore(resource.subscribe, resource.get, resource.get);
}
