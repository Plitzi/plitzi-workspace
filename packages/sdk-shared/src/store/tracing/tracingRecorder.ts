import { createRecorder } from '@plitzi/nexus';

import { MAX_CAUSES } from './tracingStore';

// Shared singleton recorder: the standard nexus change-recorder buffers the recent store writes, and the tracing
// collector drains it per commit to answer "which store write caused this render". A singleton (rather than the typed
// `middleware` per store) because the collector is itself a module singleton and several stores (sdk + builder) feed
// the same one — they push through `tracingMiddleware`'s `record` adapter.
// Typed against an open record so its `record` accepts a write from any concrete store (the path widens to `string`).
const tracingRecorder = createRecorder<Record<string, unknown>>({ max: MAX_CAUSES });

export default tracingRecorder;
