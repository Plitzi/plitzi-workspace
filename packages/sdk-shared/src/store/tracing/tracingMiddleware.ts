import tracingRecorder from './tracingRecorder';

import type { StoreMiddleware } from '@plitzi/nexus';

// Feeds committed store writes into the shared tracing recorder (nexus's `createRecorder`), which the collector drains
// per render commit to label each commit with "which store write caused it". A thin typed adapter over the singleton
// recorder's `record`, so one collector can observe several stores (sdk + builder). It's cheap regardless of whether
// the panel is open. Wire it only in `debugMode`, where the `<Profiler>` instrumentation that produces commits runs.
export const tracingMiddleware =
  <TState extends object>(): StoreMiddleware<TState> =>
  () => ({ onChange: change => tracingRecorder.record(change) });
