import { useEffect, useSyncExternalStore } from 'react';

import tracingCollector from './tracingCollector';
import tracingStore from './tracingStore';

import type { TracingState } from '../../types';

export type UseTracingReturn = TracingState & {
  clear: () => void;
};

// Reactive view of the dedicated tracing store plus the clear control. Mounting the tab starts streaming captured
// renders into the store (and immediately publishes whatever was buffered before the panel opened); unmounting stops
// the stream. `getState` returns a stable snapshot reference between changes, so it satisfies useSyncExternalStore.
const useTracing = (): UseTracingReturn => {
  const state = useSyncExternalStore(tracingStore.subscribe, tracingStore.getState, tracingStore.getState);

  useEffect(() => {
    tracingCollector.start();

    return tracingCollector.stop;
  }, []);

  return { ...state, clear: tracingCollector.clear };
};

export default useTracing;
