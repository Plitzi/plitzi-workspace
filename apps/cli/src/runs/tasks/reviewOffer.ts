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
   * What its agent or another of the team told the lead of it (`task tell`): a finding for its review — a designer's on
   * its code above all — read by whoever reviews it, not only by the lead, which reviews none a tester takes.
   */
  told?: string[];
}

/** A review offered to whoever reviews next — a lead, a tester: the task as it went to review, and what was said of it. */
export const reviewOffer = async (loaded: LoadedRun, review: TaskView, uiToo?: string): Promise<ReviewOffer> => {
  const approvedUi = review.state.design?.status === 'approved' ? review.state.design : undefined;
  const told = (await messagesOf(loaded))
    .filter(
      message =>
        message.to === LEAD &&
        message.fyi === true &&
        (message.from === review.task.id || message.about === review.task.id)
    )
    .map(message => `${message.from}: ${message.text}`);

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
