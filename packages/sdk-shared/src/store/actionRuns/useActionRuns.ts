import { useSyncExternalStore } from 'react';

import { clearActionRuns } from './actionRunsRecorder';
import actionRunsStore from './actionRunsStore';

import type { ActionRunsState } from '../../types';

export type UseActionRunsReturn = ActionRunsState & { clear: () => void };

/**
 * Reactive view of the runs this page has started.
 *
 * Recording is always on — a run that happened before the panel was opened is the one somebody is usually looking
 * for — and this is a pure view over it. `getState` returns a stable snapshot between writes, which is what
 * `useSyncExternalStore` needs.
 */
const useActionRuns = (): UseActionRunsReturn => {
  const state = useSyncExternalStore(actionRunsStore.subscribe, actionRunsStore.getState, actionRunsStore.getState);

  return { ...state, clear: clearActionRuns };
};

export default useActionRuns;
