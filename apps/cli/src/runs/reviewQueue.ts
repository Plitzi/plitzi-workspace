import type { TaskView } from './taskStore';

/** How long a UI review due waits untaken before whoever reviews the task — a tester, or the lead — takes it too. */
export const REVIEW_QUEUE_MS = 5 * 60_000;

/** A UI review nobody took past `REVIEW_QUEUE_MS`: no longer waited for — whoever reviews the task reviews its UI too. */
export const uiQueued = (view: TaskView, nowMs: number): boolean =>
  view.state.status === 'in-review' &&
  view.state.design?.status === 'due' &&
  view.state.design.by === undefined &&
  nowMs - Date.parse(view.state.design.since ?? view.state.updatedAt) >= REVIEW_QUEUE_MS;
