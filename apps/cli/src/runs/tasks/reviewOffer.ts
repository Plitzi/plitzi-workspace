import { reviewPages } from '../pagesOf';
import { askedOf } from './nextRules';
import { changesBlock } from './review';

import type { RunTask } from '../model';
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
}

/** A review offered to whoever reviews next — a lead, a tester: the task as it went to review, and what was said of it. */
export const reviewOffer = async (review: TaskView, uiToo?: string): Promise<ReviewOffer> => {
  const approvedUi = review.state.design?.status === 'approved' ? review.state.design : undefined;

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
    ...(uiToo ? { uiToo } : {})
  };
};
