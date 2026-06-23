import { onScopeDispose, shallowRef } from 'vue';

import type { AsyncResource, AsyncSnapshot } from '../async/createAsync';
import type { Ref } from 'vue';

// Reactive status of an async resource (status / data / error) for inline loading & error UI. Unlike React's
// suspense-based `useAsync`, the Vue version exposes the snapshot directly — branch on `snapshot.value.status`.
export function useAsync<T, Args extends readonly unknown[]>(resource: AsyncResource<T, Args>): Ref<AsyncSnapshot<T>> {
  const value = shallowRef(resource.get());
  onScopeDispose(
    resource.subscribe(() => {
      value.value = resource.get();
    })
  );

  return value;
}
