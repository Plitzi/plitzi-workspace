import { useEffect, useSyncExternalStore } from 'react';

import tracingCollector from './tracingCollector';
import tracingStore from './tracingStore';

import type { TracingState } from '../../types';

export type UseTracingReturn = TracingState & {
  clear: () => void;
};

// Reactive view of the dedicated tracing store plus the clear control. Mounting the tab starts streaming captured
// renders into the store (and immediately publishes whatever was buffered before the panel opened); unmounting stops
// the stream. The "which store write caused this commit" capture is wired separately as `tracingMiddleware` on the app
// store, so this hook stays a pure view. `getState` returns a stable snapshot reference between changes, satisfying
// useSyncExternalStore.
const useTracing = (): UseTracingReturn => {
  const state = useSyncExternalStore(tracingStore.subscribe, tracingStore.getState, tracingStore.getState);

  useEffect(() => {
    tracingCollector.start();

    return tracingCollector.stop;
  }, []);

  return { ...state, clear: tracingCollector.clear };
};

export default useTracing;
