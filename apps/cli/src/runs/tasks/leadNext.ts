import { isPrincipal, scoutsOf } from '../leads';
import { notLookedAtYet } from '../lookedAt';
import { LEAD } from '../messages';
import { RunRefusal } from '../refusal';
import { reviewFor, reviewTeamOf } from '../reviews';
import { isResearch } from '../spike';
import { byUrgency } from '../urgency';
import { isWorked } from '../worked';
import { reviewOffer } from './reviewOffer';
import { asksLead } from '../model';

import type { Message } from '../messages';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';
import type { NextTask } from './next';

/**
 * What the lead finds out next, nobody else at it: an agent's question (`blocked`) — its answer lifts the block (Carlos:
 * the scout answers no block) — and, with no scout in the team, a research card ready.
 */
export const findOutFor = (
  loaded: LoadedRun,
  views: readonly TaskView[],
  kinds: { research: boolean }
): NonNullable<NextTask['spike']> | undefined => {
  const urgency = byUrgency(loaded.tasks);
  const research = kinds.research
    ? views.filter(view => isResearch(view.task) && view.state.status === 'ready' && view.owner === undefined)
    : [];
  const blocking = views.filter(view => view.state.status === 'blocked' && asksLead(view.state));
  const next = [...blocking, ...research]
    .sort((a, b) => urgency(a.task, b.task) || a.task.id.localeCompare(b.task.id))
    .at(0);
  if (next === undefined) {
    return undefined;
  }

  return {
    task: next.task,
    question:
      next.state.status === 'blocked'
        ? (next.state.blockedBy?.reason ?? 'what it needs')
        : (next.task.spike ?? 'what it needs'),
    findings: next.state.findings?.length ?? 0,
    ...(next.state.status === 'blocked' ? { blocking: true as const } : {}),
    ...(loaded.plan.reference === undefined ? {} : { reference: loaded.plan.reference })
  };
};

/**
 * `task next --role lead`: what waits for the lead, the manager — a step of a card's review that is its, what a research
 * card found among them (its tasks to decide with the person); a review escalated to it is blocked on it and comes through `run watch`; a step of a card's review that is the lead's
 * (`reviews.ts`) — every one, with no tester in the team; the research cards when it has no scout. The lead reviews nothing a tester takes: every review it reads stays in its context,
 * the person's harness never started again.
 */
export const leadNext = async (
  ctx: RunContext,
  loaded: LoadedRun,
  views: readonly TaskView[],
  messages: Message[]
): Promise<Omit<NextTask, 'scratch'>> => {
  if (!isPrincipal(ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is not the lead: the lead is one — a tester reviews (plitzi task next, as the team names it), a scout finds out the spikes`
    );
  }

  // A step of a card's review that is the lead's — what a research card found among them: named by the card, or one
  // nobody else may say.
  const team = await reviewTeamOf(ctx.root);
  const review = reviewFor(views, LEAD, team, ctx.now().getTime());
  if (review) {
    return { review: await reviewOffer(loaded, review, team, LEAD), ready: [], messages };
  }

  // An agent's question always; research only with no scout in the team.
  const spike = findOutFor(loaded, views, { research: (await scoutsOf(ctx.root)).length === 0 });
  if (spike) {
    return { spike, ready: [], messages };
  }

  const open = views.filter(view => view.state.status !== 'done');
  if (open.length === 0) {
    // What is left is the lead's close, said in its order: the look `run finish` asks for, the report, the finish.
    return {
      why: `every task is approved: ${(await notLookedAtYet(ctx, loaded)) ? 'look at the result whole — plitzi run look — then ' : ''}the report (plitzi run report --summary …), then plitzi run finish`,
      ready: [],
      messages,
      finished: true
    };
  }

  const reviewing = views.filter(
    view => view.state.status === 'in-review' && view.state.review?.by !== undefined && view.state.review.by !== LEAD
  );
  const finding = views.filter(
    view => isResearch(view.task) && view.owner !== undefined && isWorked(view.state.status)
  );

  return {
    why: `nothing waits for you: ${[
      ...reviewing.map(view => `${view.task.id} is ${String(view.state.review?.by)}'s to review`),
      ...finding.map(view => `${view.task.id} is being found out by ${String(view.owner?.agent)}`),
      `${String(open.length - reviewing.length - finding.length)} task(s) still being worked`
    ].join(', ')} — what is escalated to you comes through run watch`,
    ready: [],
    messages
  };
};
