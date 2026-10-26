import type { DesignReview } from './model';
import type { TaskView } from './taskStore';

/** How long a UI review due waits untaken before whoever reviews the task — a tester, or the lead — takes it too. */
export const REVIEW_QUEUE_MS = 5 * 60_000;

/** A UI review nobody took past `REVIEW_QUEUE_MS`: no longer waited for — whoever reviews the task reviews its UI too. */
export const uiQueued = (view: TaskView, nowMs: number): boolean =>
  view.state.status === 'in-review' &&
  view.state.design?.status === 'due' &&
  view.state.design.by === undefined &&
  nowMs - Date.parse(view.state.design.since ?? view.state.updatedAt) >= REVIEW_QUEUE_MS;

/**
 * A UI review due, let go as its task leaves review — sent back, escalated, cut: who held it is kept as the one before, and
 * holds it no longer. Kept taken, it held its designer busy and in a piece until the task came back (`busyIn`,
 * `inAPiece`): never started fresh, and counted at work by the keeper.
 */
export const letGoUi = (design: DesignReview): DesignReview =>
  design.status !== 'due' || design.by === undefined
    ? design
    : {
        status: design.status,
        round: design.round,
        before: design.by,
        ...(design.why ? { why: design.why } : {}),
        ...(design.reserved ? { reserved: design.reserved } : {}),
        ...(design.since ? { since: design.since } : {})
      };
