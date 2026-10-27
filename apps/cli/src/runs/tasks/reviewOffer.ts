import { agentAddress, LEAD, messagesOf, sendMessage } from '../messages';
import { changesNoPage, reviewPages } from '../pagesOf';
import { reviewSteps, stepTimeOf, takeStep } from '../reviews';
import { logRun, readRunLog } from '../run';
import { DEFAULT_DESIGN_REVIEW, DESIGNER, readTeam } from '../team';
import { askedOf } from './nextRules';
import { changesBlock } from './review';

import type { AcceptanceResult, Quality, RunTask } from '../model';
import type { ReviewTeam } from '../reviews';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * A review offered by `task next` to whoever says its step next — a designer, a tester, a developer, the lead: the card as
 * it went to review, the step it is at, and what was said of it. One offer for every step (`reviews.ts`).
 */
export interface ReviewOffer {
  task: RunTask;
  round: number;
  /** The role whose step it is, and the card's steps in order: what this review is, and what comes after it. */
  role: string;
  step: number;
  steps: string[];
  lastRound?: true;
  changed: string[];
  pages: string[];
  /** It changes no page (`changesNoPage`): its review is its acceptance, before it and with it — no look offered. */
  noPage?: true;
  asked: string[];
  earlier: number;
  copy: string;
  /** What the steps before it said this round: a designer's approval read by the tester after it. */
  passed?: string[];
  /** Who said this step the round before: this round checks what it asked, and asks anew only what is broken. */
  before?: string;
  /** Its reviewer's first review of the run: what to read before it is said, on a line of its own. */
  first?: true;
  /** Its acceptance's checks at its `complete`: what is measured already — the review starts from what differs. */
  accepted: AcceptanceResult[];
  /** A designer's step: how closely the team asks it looked at (`options.designReview` in team.json). */
  precision?: Quality;
  /**
   * What was said of it between the lead and the team: what its agent or another told the lead (`task tell`) — a
   * designer's finding on its code above all — and what the lead said to it, its answers and decisions: read by whoever
   * reviews it, as the lead does not (encore-10's tester sent back a task for a question the lead had answered).
   */
  told?: string[];
  /** A research card's: what its scout found, the tasks it proposes, and the stage they are kept in to read. */
  found?: { by: string; text: string; tasks: string[]; stage: string };
}

/** A review offered to `agent`, at the step its card waits for: the card as it went to review, and what was said of it. */
export const reviewOffer = async (
  loaded: LoadedRun,
  review: TaskView,
  team: ReviewTeam,
  agent: string
): Promise<ReviewOffer> => {
  const steps = reviewSteps(review.task, team);
  const at = review.state.review ?? { round: review.state.round, step: 0, since: review.state.updatedAt };
  const role = steps.at(at.step) ?? LEAD;
  const told = (await messagesOf(loaded)).flatMap(message =>
    message.to === LEAD && message.fyi === true && (message.from === review.task.id || message.about === review.task.id)
      ? [`${message.from} to the lead: ${message.text}`]
      : message.from === LEAD && message.to === review.task.id
        ? [`the lead to it: ${message.text}`]
        : []
  );
  const passed = review.state.notes
    .filter(note => / review approved by /.test(note.text) && Date.parse(note.at) >= Date.parse(at.since) - 1)
    .map(note => note.text);
  const before = at.before?.[at.step];
  const reviewed = (await readRunLog(loaded.paths)).some(
    entry => entry.by === agent && entry.action === 'review-taken'
  );
  const precision =
    role === DESIGNER
      ? ((await readTeam(loaded.paths.root).catch(() => undefined))?.options?.designReview ?? DEFAULT_DESIGN_REVIEW)
      : undefined;

  return {
    task: review.task,
    round: review.state.round,
    role,
    step: at.step,
    steps,
    changed: review.state.changed ?? [],
    pages: await reviewPages(review),
    ...((await changesNoPage(review.paths.work, review.state.changed ?? [], review.task.acceptance))
      ? { noPage: true as const }
      : {}),
    ...askedOf(review.state.notes),
    ...(changesBlock(review.state) ? { lastRound: true } : {}),
    copy: review.paths.work,
    ...(passed.length > 0 ? { passed } : {}),
    ...(before !== undefined && before !== agent ? { before } : {}),
    ...(reviewed || before === agent ? {} : { first: true as const }),
    accepted: review.state.accepted ?? [],
    ...(precision ? { precision } : {}),
    ...(told.length > 0 ? { told } : {}),
    ...(review.state.proposed
      ? {
          found: {
            by: review.state.proposed.by,
            text: review.state.proposed.text,
            tasks: review.state.proposed.tasks,
            stage: review.paths.proposedStage
          }
        }
      : {})
  };
};

/**
 * A review offered, taken as `ctx.agent`'s own — and logged; one another held past its time is taken from it, and that
 * one is told on its next command. False when another took it first.
 */
export const takeOfferedStep = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  offer: Pick<ReviewOffer, 'role' | 'first'>
): Promise<boolean> => {
  const took = await takeStep(ctx, view, offer.first === true);
  if (!took.taken) {
    return false;
  }

  if (took.from !== undefined) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(took.from),
      text: `${view.task.id}'s ${offer.role} review went to ${ctx.agent}: you held it ${String(took.minutes)} min, past the ${String(stepTimeOf(view.state.review) / 60_000)} a review is its reviewer's — it is not yours now. What you found, tell the lead: plitzi task tell --about ${view.task.id} "…"`
    });
    await logRun(ctx, loaded.paths, {
      action: 'review-timed-out',
      task: view.task.id,
      review: offer.role,
      from: took.from,
      to: ctx.agent,
      minutes: took.minutes
    });
  }

  await logRun(ctx, loaded.paths, { action: 'review-taken', task: view.task.id, review: offer.role });

  return true;
};
