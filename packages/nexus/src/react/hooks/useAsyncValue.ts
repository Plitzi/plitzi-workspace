import { useAsync } from './useAsync';

import type { AsyncResource } from '../../async/createAsync';

// Suspense-friendly read: throws the in-flight promise while pending (the component suspends) and re-throws the
// error on failure (an error boundary catches it). Once resolved it returns the value — same reference the store
// holds at the path. Create the resource with `{ immediate }` so it is already loading on first read.
export function useAsyncValue<T, Args extends readonly unknown[]>(resource: AsyncResource<T, Args>): T {
  const snapshot = useAsync(resource);

  if (snapshot.status === 'error') {
    throw snapshot.error;
  }

  if (snapshot.status === 'pending') {
    const pending = resource.suspend();
    if (pending) {
      // Throwing a promise is the Suspense contract: React catches it, shows the fallback, and retries when it
      // settles. It is intentionally not an Error.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw pending;
    }
  }

  return snapshot.data as T;
}
