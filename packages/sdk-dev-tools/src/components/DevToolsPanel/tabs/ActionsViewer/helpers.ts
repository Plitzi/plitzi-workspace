import type { ActionRunEntry, ActionRunStep } from '@plitzi/sdk-shared';

/** Which runs the list shows. `live` is what somebody watches a page with; `failed` is what they came to find. */
export type RunFilter = 'all' | 'live' | 'failed';

/** The tone vocabulary the rest of the panel already speaks — see `LogStatusIcon`. */
export type StatusTone = 'danger' | 'warning' | 'success' | 'info' | 'custom';

/** Still happening: no end time, and the step that started it still holds the handle. */
export const isLive = (run: ActionRunEntry): boolean => run.endedAt === undefined;

const hasFailed = (run: ActionRunEntry): boolean => run.status === 'failed' || run.status === 'aborted';

export const runDuration = (run: ActionRunEntry): number | undefined =>
  run.endedAt === undefined ? undefined : run.endedAt - run.startedAt;

export const formatMs = (ms: number): string => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`);

export const formatTime = (value: number): string => new Date(value).toLocaleTimeString();

const TONE_BY_STATUS: Record<string, StatusTone> = {
  running: 'info',
  streaming: 'info',
  accepted: 'info',
  completed: 'success',
  failed: 'danger',
  aborted: 'warning',
  skipped: 'custom'
};

export const statusTone = (status: string): StatusTone => TONE_BY_STATUS[status] ?? 'custom';

const TONE_BY_STEP: Record<ActionRunStep['status'], StatusTone> = {
  success: 'success',
  failed: 'danger',
  skipped: 'custom',
  disabled: 'custom'
};

export const stepTone = (status: ActionRunStep['status']): StatusTone => TONE_BY_STEP[status];

export const STEP_ICON: Record<ActionRunStep['status'], string> = {
  success: 'fa-solid fa-check',
  failed: 'fa-solid fa-xmark',
  skipped: 'fa-solid fa-forward',
  disabled: 'fa-solid fa-ban'
};

/** The bar's fill, by how the step ended: a skipped step is drawn as a track, not as work. */
export const STEP_BAR: Record<ActionRunStep['status'], string> = {
  success: 'bg-emerald-500/70',
  failed: 'bg-red-500/80',
  skipped: 'bg-zinc-400/40',
  disabled: 'bg-zinc-400/30'
};

/** How the run reached the server, said in one word beside the action's name. */
export const MODE_LABEL: Record<ActionRunEntry['mode'], string> = {
  await: 'await',
  detached: 'detached',
  stream: 'stream',
  render: 'render'
};

export const MODE_ICON: Record<ActionRunEntry['mode'], string> = {
  await: 'fa-solid fa-right-left',
  detached: 'fa-solid fa-paper-plane',
  stream: 'fa-solid fa-wave-square',
  render: 'fa-solid fa-server'
};

export const stepCount = (count: number): string => `${count} ${count === 1 ? 'step' : 'steps'}`;

/** Where a flow broke — the first thing anybody opening a failed run is looking for. */
export const failedStep = (steps: ActionRunStep[] | undefined): ActionRunStep | undefined =>
  steps?.find(step => step.status === 'failed');

/**
 * Whether a run answers to what was typed in the search box.
 *
 * Everything a person might have in mind when they go looking: the action, the run id the server put in the header,
 * the element a render fed, how it ended, and the steps themselves — a flow is often remembered by the step that
 * breaks rather than by its own name.
 */
export const matchesQuery = (run: ActionRunEntry, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }

  const haystack = [
    run.actionId,
    run.runId,
    run.elementId,
    run.status,
    run.reason,
    run.error,
    ...(run.steps ?? []).map(step => `${step.title} ${step.action} ${step.error ?? ''}`)
  ];

  return haystack.some(value => typeof value === 'string' && value.toLowerCase().includes(needle));
};

export const filterRuns = (runs: ActionRunEntry[], filter: RunFilter, query: string): ActionRunEntry[] =>
  runs.filter(run => {
    if (filter === 'live' && !isLive(run)) {
      return false;
    }

    if (filter === 'failed' && !hasFailed(run)) {
      return false;
    }

    return matchesQuery(run, query);
  });

/** One step placed on the run's own wall clock. */
export type StepBar = { step: ActionRunStep; offset: number; width: number };

/**
 * Each step as a share of the whole run, so the timeline shows WHERE the time went.
 *
 * Against the run's own span rather than a fixed scale: what matters is which step took the flow, and a run of 40ms
 * and one of 40s are read the same way. A step too short to see is still given a sliver — a step that ran and a step
 * that did not must never look alike.
 */
export const stepBars = (steps: ActionRunStep[]): StepBar[] => {
  if (steps.length === 0) {
    return [];
  }

  const start = Math.min(...steps.map(step => step.startTime));
  const end = Math.max(...steps.map(step => step.endTime));
  const span = end - start;

  return steps.map(step => {
    if (span <= 0) {
      return { step, offset: 0, width: 1 };
    }

    return {
      step,
      offset: (step.startTime - start) / span,
      width: Math.max((step.endTime - step.startTime) / span, 0.02)
    };
  });
};

/** Which step a trace entry belongs to. The store keeps the trace as the server sent it, so it is read, not trusted. */
const traceNodeId = (entry: Record<string, unknown>): string | undefined => {
  const { node } = entry;
  if (typeof node !== 'object' || node === null || !('id' in node)) {
    return undefined;
  }

  const { id } = node;

  return typeof id === 'string' ? id : undefined;
};

/**
 * What a step actually READ and ANSWERED, when the deployment sent the full trace.
 *
 * Only an authoring session and a development server ever receive it — a visitor's answer carries the outline and
 * nothing else — so this returns `undefined` far more often than not, and the panel says so rather than showing a
 * blank where data would be.
 */
export const traceResultOf = (trace: Record<string, unknown>[] | undefined, stepId: string): unknown =>
  trace?.find(entry => traceNodeId(entry) === stepId)?.result;
