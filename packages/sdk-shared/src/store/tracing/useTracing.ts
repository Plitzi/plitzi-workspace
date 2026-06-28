import { useEffect, useSyncExternalStore } from 'react';

import { useStoreById } from '@plitzi/nexus/react';

import { getByPath, previewValue } from './preview';
import tracingCollector from './tracingCollector';
import tracingStore from './tracingStore';

import type { CommonState, TracingState } from '../../types';

export type UseTracingReturn = TracingState & {
  clear: () => void;
};

// Reactive view of the dedicated tracing store plus the clear control. Mounting the tab starts streaming captured
// renders into the store (and immediately publishes whatever was buffered before the panel opened); unmounting stops
// the stream. While mounted it also taps the nearest store's `subscribeChange` so each commit can record WHICH store
// paths triggered it ("why did it render"). `getState` returns a stable snapshot reference between changes, so it
// satisfies useSyncExternalStore.
const useTracing = (): UseTracingReturn => {
  const state = useSyncExternalStore(tracingStore.subscribe, tracingStore.getState, tracingStore.getState);
  const store = useStoreById<CommonState>();

  useEffect(() => {
    tracingCollector.start();

    return tracingCollector.stop;
  }, []);

  useEffect(
    () =>
      store.subscribeChange(change => {
        if (change.path === undefined) {
          return;
        }

        const before = previewValue(getByPath(change.prev, change.path));
        const after = previewValue(getByPath(change.next, change.path));
        tracingCollector.recordChange(change.path, `${before} → ${after}`);
      }),
    [store]
  );

  return { ...state, clear: tracingCollector.clear };
};

export default useTracing;
