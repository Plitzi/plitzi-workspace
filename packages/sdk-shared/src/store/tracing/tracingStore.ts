import { createStore } from '@plitzi/nexus';

import type { TracingState } from '../../types';

// Newest commits are kept; older ones are dropped past this cap so a long session can't grow unbounded.
export const MAX_COMMITS = 200;

// Recent store writes the recorder retains; a commit's "causes" are drained from this window.
export const MAX_CAUSES = 30;

export const createTracingState = (): TracingState => ({ enabled: false, hydrated: false, commits: [], tree: {} });

// DEDICATED, isolated store — intentionally NOT part of the reactive CommonState. Tracing writes happen on every
// render commit; if they lived on the root store, the per-element scoped stores would inherit that change through
// the parent fall-through and wake their broad subscribers, re-rendering elements → firing the <Profiler> again →
// writing trace again → an infinite render loop. A separate store no element subscribes to breaks that cycle.
const tracingStore = createStore<TracingState>(createTracingState(), { id: 'tracing' });

export default tracingStore;
