import { previewValue } from './preview';
import tracingCollector from './tracingCollector';

import type { StoreMiddleware } from '@plitzi/nexus';

// Captures "store write → tracing cause" as a store middleware, riding the same `onChange` channel the dev-tools
// console logger already uses. This standardizes the dev-tools store taps (both are now middlewares declared at store
// creation) and runs on the real app store — instead of the panel tapping `subscribeChange` on whatever store
// `useStoreById` happens to resolve. It's cheap when the panel is closed: `recordChange` ignores writes unless the
// Tracing tab is open. Wire it only in `debugMode`, where the `<Profiler>` instrumentation that produces commits runs.
export const tracingMiddleware =
  <TState extends object>(): StoreMiddleware<TState> =>
  () => ({
    onChange: change => {
      if (change.path === undefined) {
        return;
      }

      tracingCollector.recordChange(
        change.path,
        `${previewValue(change.prevValue)} → ${previewValue(change.nextValue)}`
      );
    }
  });
