import { createStore } from '@plitzi/nexus';

import type { TracingState } from '../../types';

// Newest commits are kept; older ones are dropped past this cap so a long session can't grow unbounded.
export const MAX_COMMITS = 200;

/**
 * How many element INSTANCES the accumulated tree may hold before it is started over.
 *
 * The tree is keyed per instance — a list of ninety rows is ninety nodes — and nothing ever removes one: an element
 * that unmounts leaves its entry behind, because the collector hears about renders and never about teardowns. Across
 * a long session of navigating between dense pages that grows without bound, which on the page it is most worth
 * profiling is the thing that eventually takes the tab down.
 *
 * Cleared wholesale rather than pruned, because there is no cheap way to know which entry is stale: the tree is
 * written on the hot path, once per element per render, and an LRU touch there costs more than the leak. Losing it
 * costs one commit's worth of hatched ancestors and then rebuilds from the next render.
 */
export const MAX_TREE_NODES = 20_000;

// Recent store writes the recorder retains; a commit's "causes" are drained from this window.
export const MAX_CAUSES = 30;

export const createTracingState = (): TracingState => ({ enabled: false, hydrated: false, commits: [], tree: {} });

// DEDICATED, isolated store — intentionally NOT part of the reactive CommonState. Tracing writes happen on every
// render commit; if they lived on the root store, the per-element scoped stores would inherit that change through
// the parent fall-through and wake their broad subscribers, re-rendering elements → firing the <Profiler> again →
// writing trace again → an infinite render loop. A separate store no element subscribes to breaks that cycle.
const tracingStore = createStore<TracingState>(createTracingState(), { id: 'tracing' });

export default tracingStore;
