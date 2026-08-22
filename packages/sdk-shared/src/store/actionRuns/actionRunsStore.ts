import { createStore } from '@plitzi/nexus';

import type { ActionRunsState } from '../../types';

/** Newest runs are kept; older ones drop off, so a page left open all day cannot grow unbounded. */
export const MAX_RUNS = 100;

export const createActionRunsState = (): ActionRunsState => ({ runs: [] });

/**
 * DEDICATED, isolated store — deliberately not part of the reactive `CommonState`.
 *
 * A run is developer-facing evidence, not page state: nothing an element renders should re-render because a
 * server action reported progress, and a page that binds `{{ … }}` to anything here would be binding to the
 * debugger. It follows the tracing store for exactly that reason, and for one more: the panel renders outside the
 * app's provider tree and needs a store it can read without one.
 */
const actionRunsStore = createStore<ActionRunsState>(createActionRunsState(), { id: 'action-runs' });

export default actionRunsStore;
