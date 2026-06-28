import tracingCollector from './tracingCollector';

import type { StoreMiddleware } from '@plitzi/nexus';

// Feeds committed store writes into the tracing collector, which buffers them (via nexus's `createRecorder`) and drains
// them per render commit to label each commit with "which store write caused it". A thin typed adapter, so one
// collector can observe several stores (sdk + builder). Cheap regardless of whether the panel is open. Wire it only in
// `debugMode`, where the `<Profiler>` instrumentation that produces commits runs.
export const tracingMiddleware =
  <TState extends object>(): StoreMiddleware<TState> =>
  () => ({ onChange: change => tracingCollector.recordStoreChange(change) });
