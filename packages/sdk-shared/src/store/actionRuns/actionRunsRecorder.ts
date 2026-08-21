import actionRunsStore, { MAX_RUNS } from './actionRunsStore';

import type { ActionRunEntry } from '../../types';

let seq = 0;

const write = (runs: ActionRunEntry[]) => actionRunsStore.setState('runs', runs);

/**
 * Records a run this page STARTED, the moment it is sent.
 *
 * Written when the request leaves rather than when it answers, because the interesting failures are the ones with
 * no answer: a detached run whose response nobody awaits, a stream that never opens, a server that is not there.
 * A record that only appeared on success would be missing exactly the runs somebody is looking for.
 */
export const recordActionRun = (entry: Omit<ActionRunEntry, 'id' | 'startedAt' | 'status' | 'progress'>): string => {
  seq += 1;
  const id = `run-${seq}`;
  const run: ActionRunEntry = { ...entry, id, status: 'running', startedAt: Date.now(), progress: [] };
  write([run, ...actionRunsStore.getState().runs].slice(0, MAX_RUNS));

  return id;
};

/** How it ended, or what it reported on the way. Unknown ids are ignored: a swept-out run is not an error. */
export const updateActionRun = (id: string, patch: Partial<Omit<ActionRunEntry, 'id'>>): void => {
  const { runs } = actionRunsStore.getState();
  if (!runs.some(run => run.id === id)) {
    return;
  }

  write(runs.map(run => (run.id === id ? { ...run, ...patch } : run)));
};

/** One chunk a streaming run emitted, kept in order beside the run it belongs to. */
export const recordActionProgress = (id: string, chunk: unknown): void => {
  const { runs } = actionRunsStore.getState();
  write(runs.map(run => (run.id === id ? { ...run, progress: [...run.progress, chunk] } : run)));
};

export const clearActionRuns = (): void => write([]);
