import actionRunsStore, { MAX_PROGRESS_CHUNKS, MAX_RUNS } from './actionRunsStore';

import type { ActionRunEntry, ActionRunSummary } from '../../types';

let seq = 0;

const write = (runs: ActionRunEntry[]) => actionRunsStore.setState('runs', runs);

/**
 * How to stop each live run, kept OUT of the store.
 *
 * The store is data a panel renders and a devtool may serialize; an abort controller and a fetch are neither. The
 * step that started the run owns the handle and registers it here, which is also what keeps this module free of
 * any idea of how a run is transported.
 */
const cancellers = new Map<string, () => void>();

/** Registered by whatever started the run, for as long as stopping it means anything. */
export const registerActionCanceller = (id: string, cancel: () => void): void => {
  cancellers.set(id, cancel);
};

export const releaseActionCanceller = (id: string): void => {
  cancellers.delete(id);
};

/**
 * Stops a run from outside the flow that started it — the dev-tools panel, today.
 *
 * It is deliberately the step's own canceller rather than a request built here: a run is stopped by aborting the
 * request that carries it AND, when the server has already named it, by telling the server so. Which of those
 * apply is something only the step knows.
 */
export const cancelActionRun = (id: string): void => {
  cancellers.get(id)?.();
};

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
  const run: ActionRunEntry = {
    ...entry,
    id,
    status: 'running',
    startedAt: Date.now(),
    progress: [],
    cancellable: true
  };
  write([run, ...actionRunsStore.getState().runs].slice(0, MAX_RUNS));

  return id;
};

const renderEntry = (summary: ActionRunSummary): ActionRunEntry => ({
  // The server's own id: a render run is already over when it arrives, so there is no local id to have assigned.
  id: `render-${summary.runId}`,
  actionId: summary.actionId,
  mode: 'render',
  runId: summary.runId,
  status: summary.status,
  steps: summary.steps,
  progress: [],
  startedAt: summary.startedAt,
  endedAt: summary.endedAt,
  ...(summary.error === undefined ? {} : { error: summary.error }),
  ...(summary.elementId === undefined ? {} : { elementId: summary.elementId })
});

/**
 * Records the runs the SERVER did while building this page, or while answering a refresh of part of it.
 *
 * Nobody here started them, so without this they are the one kind of run a page cannot see at all — an empty
 * section and no way to learn why. Deduped by the server's own run id, because a section refreshing itself
 * re-reports a run that was joined or reused rather than started again: the same run twice would leave a person
 * comparing two entries that are one.
 */
export const recordRenderActionRuns = (summaries: ActionRunSummary[]): void => {
  const { runs } = actionRunsStore.getState();
  const known = new Set(runs.map(run => run.runId));
  const added = summaries.filter(summary => !known.has(summary.runId)).map(renderEntry);
  if (added.length === 0) {
    return;
  }

  // Newest first, as everything else in the log: the server ran them in order, so the last one it did is the newest.
  write([...added.reverse(), ...runs].slice(0, MAX_RUNS));
};

/** How it ended, or what it reported on the way. Unknown ids are ignored: a swept-out run is not an error. */
export const updateActionRun = (id: string, patch: Partial<Omit<ActionRunEntry, 'id'>>): void => {
  const { runs } = actionRunsStore.getState();
  if (!runs.some(run => run.id === id)) {
    return;
  }

  write(runs.map(run => (run.id === id ? { ...run, ...patch } : run)));
};

/**
 * One chunk a streaming run emitted, kept in order beside the run it belongs to.
 *
 * Capped, and the OLDEST go. The server bounds its own SSE buffer at a megabyte for a peer that stopped reading;
 * nothing bounded this side, so a stream that runs long — a model answering token by token, a job reporting every
 * row — grew a panel's array without limit for as long as the tab stayed open. What a person scrolls back to is
 * the end of a stream, so the end is what is kept.
 */
export const recordActionProgress = (id: string, chunk: unknown): void => {
  const { runs } = actionRunsStore.getState();
  write(
    runs.map(run => (run.id === id ? { ...run, progress: [...run.progress, chunk].slice(-MAX_PROGRESS_CHUNKS) } : run))
  );
};

/**
 * Empties the log. Live runs keep their cancellers: clearing the panel is tidying a VIEW, and taking away the only
 * way to stop a run that is still going is not something a person asked for by pressing it.
 */
export const clearActionRuns = (): void => {
  const live = new Set(
    actionRunsStore
      .getState()
      .runs.filter(run => run.cancellable)
      .map(run => run.id)
  );
  [...cancellers.keys()].forEach(id => {
    if (!live.has(id)) {
      cancellers.delete(id);
    }
  });
  write([]);
};
