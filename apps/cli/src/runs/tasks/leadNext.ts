import { isPrincipal, leadReviewFor, leadReviews, reviewTeamOf, scoutsOf } from '../leads';
import { notLookedAtYet } from '../lookedAt';
import { RunRefusal } from '../refusal';
import { uiQueued } from '../reviewQueue';
import { DESIGNER, readTeam, startedAgents } from '../team';
import { byUrgency } from '../urgency';
import { isWorked } from '../worked';
import { reviewOffer } from './reviewOffer';

import type { Message } from '../messages';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';
import type { NextTask } from './next';

/** The team's designers, by name. */
export const designersIn = async (ctx: RunContext): Promise<string[]> => {
  const team = await readTeam(ctx.root).catch(() => undefined);

  return (team ? startedAgents(team) : []).filter(each => each.roles.includes(DESIGNER)).map(each => each.agent);
};

/**
 * Whether no designer is free for a UI review: each at a task of its own, or none in the team. A UI review then waits for
 * nobody, and every review behind it with it (seven tasks in review, the one designer redoing its own): whoever reviews
 * the task reviews its UI too.
 */
export const noDesignerFreeIn = async (ctx: RunContext, views: readonly TaskView[]): Promise<boolean> => {
  const busy = (agent: string): boolean =>
    views.some(view => view.owner?.agent === agent && isWorked(view.state.status));

  return (await designersIn(ctx)).every(busy);
};

/** What a reviewer offered a UI review no designer is free for is told to do. */
export const uiTooText = (agent: string, designers: readonly string[]): string =>
  `its UI waits for a designer and none is free${designers.length > 0 ? ` (${designers.join(', ')} at a task of its own)` : ''}: review its UI too — as the original, both schemes, the phone width — and approve with plitzi task review <task> --approve --skip-design ${agent}, which the report says as your UI review`;

/**
 * The spike `agent` finds out next: the one it holds first, then the most urgent nobody took. A research spike — a
 * scout's, or the lead's with no scout — whose tasks wait for the lead is not offered; one the lead sent back is, to the
 * scout that proposed it, with what the lead asked. An agent's question (`blocked`) is the lead's alone: its answer lifts
 * the block (Carlos: the scout answers no block).
 */
export const spikeFor = (
  loaded: LoadedRun,
  views: readonly TaskView[],
  agent: string,
  kinds: { research: boolean; blocked: boolean }
): NonNullable<NextTask['spike']> | undefined => {
  const urgency = byUrgency(loaded.tasks);
  const free = (view: TaskView): boolean => (view.state.spikedBy?.by ?? agent) === agent;
  const research = kinds.research
    ? views.filter(view => view.state.status === 'spike' && view.state.proposed === undefined && free(view))
    : [];
  const blocking = kinds.blocked
    ? views.filter(view => view.state.status === 'blocked' && view.state.blockedBy?.spike !== undefined && free(view))
    : [];
  const mine = (view: TaskView): number => (view.state.spikedBy?.by === agent ? 0 : 1);
  const next = [...research, ...blocking]
    .sort((a, b) => mine(a) - mine(b) || urgency(a.task, b.task) || a.task.id.localeCompare(b.task.id))
    .at(0);
  if (next === undefined) {
    return undefined;
  }

  const asked = next.state.notes
    .findLast(note => note.text.startsWith('Sent back: '))
    ?.text.slice('Sent back: '.length);

  return {
    task: next.task,
    question: next.state.blockedBy?.spike ?? next.task.spike ?? 'what it needs',
    findings: next.state.findings?.length ?? 0,
    ...(next.state.status === 'blocked' ? { blocking: true as const } : {}),
    ...(asked !== undefined && next.state.spikedBy?.by === agent ? { asked } : {})
  };
};

/**
 * `task next --role lead`: what waits for the lead, the manager — the tasks a scout proposes, to decide with the person;
 * a review escalated to it is blocked on it and comes through `run watch`; a review nobody else may take — every one,
 * with no tester in the team (`leadReviews`); the spikes when it has no scout. The lead reviews nothing a tester takes: every review it reads stays in its context,
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

  const urgency = byUrgency(loaded.tasks);
  const proposed = views
    .filter(view => view.state.proposed !== undefined)
    .sort((a, b) => urgency(a.task, b.task) || a.task.id.localeCompare(b.task.id))
    .at(0);
  if (proposed?.state.proposed) {
    const { by, text, tasks } = proposed.state.proposed;

    return {
      proposal: {
        task: proposed.task,
        by,
        text,
        tasks,
        stage: proposed.paths.proposedStage
      },
      ready: [],
      messages
    };
  }

  const team = await reviewTeamOf(ctx.root);
  const theirs = views.filter(view => leadReviews(view, views, team));
  if (theirs.length > 0) {
    const noDesignerFree = await noDesignerFreeIn(ctx, views);
    const review = leadReviewFor(theirs, ctx.agent, view => noDesignerFree || uiQueued(view, ctx.now().getTime()));
    if (review) {
      return {
        leadReview: await reviewOffer(
          loaded,
          review,
          review.state.design?.status === 'due' ? uiTooText(ctx.agent, await designersIn(ctx)) : undefined
        ),
        ready: [],
        messages
      };
    }
  }

  // An agent's question always; research only with no scout in the team.
  const spike = spikeFor(loaded, views, ctx.agent, {
    research: (await scoutsOf(ctx.root)).length === 0,
    blocked: true
  });
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
    view =>
      view.state.status === 'in-review' &&
      view.state.reviewer?.round === view.state.round &&
      view.state.reviewer.by !== ctx.agent
  );
  const finding = views.filter(view => view.state.status === 'spike');

  return {
    why: `nothing waits for you: ${[
      ...reviewing.map(view => `${view.task.id} is ${String(view.state.reviewer?.by)}'s to review`),
      ...finding.map(
        view => `${view.task.id} is being found out${view.state.spikedBy ? ` by ${view.state.spikedBy.by}` : ''}`
      ),
      `${String(open.length - reviewing.length - finding.length)} task(s) still being worked`
    ].join(', ')} — what is escalated to you comes through run watch`,
    ready: [],
    messages
  };
};
