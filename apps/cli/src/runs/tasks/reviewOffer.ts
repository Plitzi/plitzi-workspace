import { LEAD, messagesOf } from '../messages';
import { reviewPages } from '../pagesOf';
import { askedOf } from './nextRules';
import { changesBlock } from './review';

import type { RunTask } from '../model';
import type { LoadedRun } from '../run';
import type { TaskView } from '../taskStore';

/** A review offered by `task next` to whoever reviews next — a lead, a tester: the task as it went to review. */
export interface ReviewOffer {
  task: RunTask;
  round: number;
  lastRound?: true;
  changed: string[];
  pages: string[];
  asked: string[];
  earlier: number;
  copy: string;
  /** A designer approved its UI: what it said, when it said something. */
  design?: string;
  /** Its UI review waits for a designer and none is free: the lead's too, said how. */
  uiToo?: string;
  /**
   * What was said of it between the lead and the team: what its agent or another told the lead (`task tell`) — a
   * designer's finding on its code above all — and what the lead said to it, its answers and decisions: read by whoever
   * reviews it, as the lead does not (encore-10's tester sent back a task for a question the lead had answered).
   */
  told?: string[];
}

/** A review offered to whoever reviews next — a lead, a tester: the task as it went to review, and what was said of it. */
export const reviewOffer = async (loaded: LoadedRun, review: TaskView, uiToo?: string): Promise<ReviewOffer> => {
  const approvedUi = review.state.design?.status === 'approved' ? review.state.design : undefined;
  const told = (await messagesOf(loaded)).flatMap(message =>
    message.to === LEAD && message.fyi === true && (message.from === review.task.id || message.about === review.task.id)
      ? [`${message.from} to the lead: ${message.text}`]
      : message.from === LEAD && message.to === review.task.id
        ? [`the lead to it: ${message.text}`]
        : []
  );

  return {
    task: review.task,
    round: review.state.round,
    changed: review.state.changed ?? [],
    pages: await reviewPages(review),
    ...askedOf(review.state.notes),
    ...(changesBlock(review.state, false) ? { lastRound: true } : {}),
    copy: review.paths.work,
    ...(approvedUi
      ? {
          design:
            review.state.notes.findLast(note => note.text.startsWith('Its UI approved by'))?.text ??
            `its UI approved by ${approvedUi.by ?? 'a designer'}`
        }
      : {}),
    ...(uiToo ? { uiToo } : {}),
    ...(told.length > 0 ? { told } : {})
  };
};
