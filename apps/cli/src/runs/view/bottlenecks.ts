import { busyIn } from '../agents/onDemand';
import { SCOUT, TESTER } from '../agents/team';
import { isWorked } from '../agents/worked';
import { isResearch, roleOf } from '../plan/spike';
import { LEAD } from '../talk/messages';
import {
  REVIEW_QUEUE_MS,
  reviewRolesOf,
  reviewSteps,
  reviewTeamOfAgents,
  stepQueued,
  stepReviewers,
  stepRole,
  stepTimeOf
} from '../tasks/reviews';

import type { Attention } from './view';
import type { StartedAgent } from '../agents/team';
import type { RunTask } from '../core/model';
import type { TaskView } from '../core/taskStore';

/** Where a task another waits for is held past its work — in a review, sent back, blocked — or nothing while it is worked. */
const heldIn = (view: TaskView): string | undefined =>
  view.state.status === 'in-review'
    ? 'review'
    : view.state.status === 'changes-requested'
      ? `sent back, round ${String(view.state.round)}`
      : view.state.status === 'blocked'
        ? 'blocked'
        : undefined;

/**
 * The kinds of advice the board gives the lead — computed, never kept: the lead settles one by its kind, with what it
 * decided (`run settle idle-team --note "…"`), and it is said no more in the run (a run's lead kept a run small on
 * purpose and was woken twice to stack the backlog).
 */
export const ADVICE_KINDS = ['review-waits', 'held-up', 'slow-review', 'spikes', 'idle-team'] as const;

/**
 * The advice that waits for the lead's next wake, never wakes it: what the team could take on more — a task held
 * behind another, an agent with nothing to take. A run's lead was woken at each approval for one idle developer, and
 * three times for dependencies that were real by what the tasks read, each a turn of its own.
 */
export const QUIET_ADVICE: readonly Attention['kind'][] = ['held-up', 'idle-team'];

/**
 * What holds the run's work back that only the lead can free: reviews none of whose reviewers is free to take, and a
 * task that could start held behind others in review while agents of its role have nothing to take — each with the way
 * out.
 */
export const bottlenecks = (
  views: readonly TaskView[],
  started: readonly StartedAgent[],
  now: Date,
  /** The project's backlog items still open that no task of the run does: work the lead can stack. */
  backlog: readonly string[] = [],
  /**
   * The whole team, running or not: whether it has testers and scouts — `started` holds only those running, and a scout
   * stopped between two pieces read as none (a run's spike told the lead "the team has no scout").
   */
  team: readonly StartedAgent[] = started
): Attention[] => {
  const found: Attention[] = [];
  // Who reviews and who finds out: the team's testers and scouts — the lead, manager, only when it has none.
  const testers = team.some(each => each.roles.includes(TESTER));
  const scouts = team.some(each => each.roles.includes(SCOUT));
  const byId = new Map(views.map(view => [view.task.id, view] as const));
  const approvedIds = new Set(views.filter(view => view.state.status === 'done').map(view => view.task.id));
  const atOwn = (agent: string): string | undefined =>
    views.find(view => view.owner?.agent === agent && isWorked(view.state.status))?.task.id;
  // Busy at a task of its own, or at another card's review: a run's one tester, reviewing card after card, read as free,
  // and a review waited 33 minutes with nothing said.
  const busyAt = (agent: string, except?: string): string | undefined =>
    atOwn(agent) ??
    views.find(view => view.task.id !== except && view.state.review?.by === agent && view.state.status === 'in-review')
      ?.task.id;
  // A step nobody took past its queue's time, every one of its reviewers at a task of its own: the run waits on it — the
  // lead starts another of the role, or says it itself.
  const reviewTeam = reviewTeamOfAgents(team);
  const waiting = views.flatMap(view => {
    const role = stepRole(view, reviewTeam);
    const { review } = view.state;
    if (role === undefined || review === undefined || !stepQueued(review, now.getTime())) {
      return [];
    }

    const reviewers = stepReviewers(view, views, role, reviewTeam).filter(agent => agent !== LEAD);

    return reviewers.length > 0 && reviewers.every(agent => busyAt(agent, view.task.id) !== undefined)
      ? [{ view, role, reviewers }]
      : [];
  });
  if (waiting.length > 0) {
    const roles = [...new Set(waiting.map(each => each.role))];
    // Another of the role the run may start — on demand, not running: the keeper starts it. None left: the team is at
    // its most, which only the person moves.
    const atMost = roles.every(role => team.every(each => !each.roles.includes(role) || started.includes(each)));
    found.push({
      kind: 'review-waits',
      text: `${waiting.map(each => `${each.view.task.id} (its ${each.role}'s review)`).join(', ')} ${waiting.length === 1 ? 'waits' : 'wait'} past ${String(REVIEW_QUEUE_MS / 60_000)} min, every reviewer of ${waiting.length === 1 ? 'it' : 'them'} busy (${[...new Set(waiting.flatMap(each => each.reviewers))].map(agent => `${agent} at ${String(busyAt(agent))}`).join(', ')}): ${
        atMost
          ? `the team has no other ${roles.join(' or ')} — one more is the person's to allow: ask them (plitzi run team set <entry> --count <n>, in their terminal)`
          : 'another is started as the team allows'
      } — or decide ${waiting.length === 1 ? 'it' : 'them'} yourself: plitzi task look ${waiting[0]?.view.task.id ?? '<task>'}, then plitzi task review <task> --approve | --changes "…"`,
      who: 'lead'
    });
  }

  // A task that could start, held behind one going round its reviews while agents of its role sit free: the lead's to
  // unblock — a run's t-motion waited three rounds of t-boxer's UI review it needed nothing from, two developers idle.
  // At a review of its own or a spike — never free (a run's scout read "nothing to take" at its spike).
  const reviewing = new Set(views.flatMap(busyIn));
  const free = (role: string): string[] =>
    started
      .filter(each => each.roles.includes(role) && atOwn(each.agent) === undefined && !reviewing.has(each.agent))
      .map(each => each.agent);
  for (const view of views.filter(each => each.state.status === 'pending')) {
    const held = view.task.dependsOn.flatMap(id => {
      const other = byId.get(id);

      return other && heldIn(other) !== undefined ? [other] : [];
    });
    const role = roleOf(view.task);
    // Free with a ready task of their role to take, they are not held: only free with nothing to take are they.
    const idle = views.some(each => each.state.status === 'ready' && roleOf(each.task) === role) ? [] : free(role);
    const waitsOn = view.task.dependsOn.filter(id => !approvedIds.has(id));
    // The tests of what it waits for wait for it by what they are: no dependency to take away (a run's watch
    // told the lead to, for a task of tests).
    const tests = held.some(other => view.task.testsOf?.includes(other.task.id) === true);
    if (held.length === 0 || held.length !== waitsOn.length || idle.length === 0 || tests) {
      continue;
    }

    // What a task touches beside its files is shared too: one that fills a module the held task makes needs it made.
    const reaches = (task: RunTask): string[] => [...task.files, ...(task.touches ?? [])];
    const shared = [...new Set(reaches(view.task))].filter(file =>
      held.some(other => reaches(other.task).includes(file))
    );
    found.push({
      kind: 'held-up',
      task: view.task.id,
      text: `${view.task.id} waits for ${held.map(other => `${other.task.id} (${String(heldIn(other))})`).join(', ')} while ${idle.join(', ')} ${idle.length === 1 ? 'is' : 'are'} free: ${
        shared.length === 0
          ? `they share no file — if ${view.task.id} needs nothing they make (no action, data or module it calls: a page that asks their server action needs it there), take the dependency away and it starts now (its dependsOn in the plan, then plitzi run amend)`
          : `they share ${shared.join(', ')} — review ${held.map(other => other.task.id).join(', ')} first (plitzi task next --role lead --no-wait), or settle what is left yourself`
      }`,
      who: 'lead'
    });
  }

  // A review taken and not decided past its time: the run waits on one agent, and only the lead can ask it where it
  // stands or decide it — a run's last task sat in a designer's review, five agents idle.
  for (const view of views.filter(each => each.state.status === 'in-review')) {
    const { review } = view.state;
    const taken =
      review?.by !== undefined && review.at !== undefined && review.by !== LEAD
        ? { by: review.by, at: review.at, what: `${stepRole(view, reviewTeam) ?? 'its'} review` }
        : undefined;
    const held = taken ? now.getTime() - Date.parse(taken.at) : 0;
    const time = stepTimeOf(review);
    // Past the review's time, and only then: halfway, with others free, woke a run's lead at 4 min of every long
    // review — free agents that could not have taken it, nothing else to give them.
    if (!taken || held < time) {
      continue;
    }

    const minutes = Math.round(held / 60_000);
    found.push({
      kind: 'slow-review',
      task: view.task.id,
      // The lead manages: with testers, it asks — the review stays a tester's, escalated to it if it cannot decide.
      text: testers
        ? `${taken.by} has held ${view.task.id}'s ${taken.what} ${String(minutes)} min, past the ${String(time / 60_000)} a review takes: ask where it stands and for its verdict — plitzi task message @${taken.by} "…" — or that it escalates what it cannot decide`
        : `${taken.by} has held ${view.task.id}'s ${taken.what} ${String(minutes)} min, past the ${String(time / 60_000)} a review is its reviewer's: another of its role takes it — or decide it yourself now: plitzi task look ${view.task.id}, then plitzi task review ${view.task.id} --approve | --changes "…"`,
      who: 'lead'
    });
  }

  found.push(...idleTeam(views, started, backlog, team));

  // A research card is a scout's, its result the lead's to approve (a proposal, said apart); with no scout the lead finds
  // it out.
  const spikes = views.filter(view => isResearch(view.task) && view.state.status === 'ready');
  if (spikes.length > 0 && !scouts) {
    found.push({
      kind: 'spikes',
      text: `${spikes.map(view => `${view.task.id} (${view.task.spike ?? 'what it needs'})`).join('; ')} ${spikes.length === 1 ? 'is' : 'are'} research, yours to find out (the team has no scout) — look, check, measure (beside the site it copies, when it copies one) — then plitzi task complete <card> --found "what was found" [--tasks <stage.json>]`,
      who: 'lead'
    });
  }

  return found;
};

/**
 * The run as a kanban: the lead keeps every agent busy. An agent running with nothing of its own being worked, no review
 * in hand and no card of its roles ready is starved — said to the lead with the way to feed it: the backlog's items no
 * task does yet, a large card to split; with nothing left, that it may go.
 * Three cards for two agents, each agent waited its own verdicts with nothing to take, the designer idle
 * nine minutes beside two cards in review whose UI looks the lead had kept.
 */
export const idleTeam = (
  views: readonly TaskView[],
  /** The team's agents running now. */
  running: readonly StartedAgent[],
  backlog: readonly string[],
  /** The whole team, running or not: whose a review's step is — a tester not started yet still says it. */
  team: readonly StartedAgent[] = running
): Attention[] => {
  if (views.length === 0 || views.every(view => view.state.status === 'done')) {
    return [];
  }

  const busy = new Set(views.flatMap(busyIn));
  const readyFor = (roles: readonly string[]): boolean =>
    views.some(view => view.state.status === 'ready' && roles.includes(roleOf(view.task)));
  // A reviewer while cards it will review are under way waits for them, which is what it is for — and waiting costs
  // nothing: a run's idle-team told the lead to split a developer's card for the run's only UI reviewer.
  const reviewTeam = reviewTeamOfAgents(running);
  const reviewsComing = (agent: string): boolean => {
    const roles = reviewRolesOf(reviewTeam, agent);

    return views.some(
      view =>
        view.owner !== undefined &&
        view.owner.agent !== agent &&
        isWorked(view.state.status) &&
        reviewSteps(view.task, reviewTeam).some(role => roles.includes(role))
    );
  };
  // An agent none of whose role's cards is left has done its part: a run's lead was woken eight times at the end, for
  // developers with nothing of theirs left and a tester's spec it could not split for them. Research in review is the
  // lead's to decide, no card of its scout's: a run's scout was said idle beside its scope, the backlog to stack for it.
  const leftFor = (roles: readonly string[]): boolean =>
    views.some(
      view =>
        view.state.status !== 'done' &&
        !(isResearch(view.task) && view.state.status === 'in-review') &&
        roles.includes(roleOf(view.task))
    );
  const starved = running.filter(
    each => !busy.has(each.agent) && !readyFor(each.roles) && leftFor(each.roles) && !reviewsComing(each.agent)
  );
  if (starved.length === 0) {
    return [];
  }

  const names = starved.map(each => each.agent);
  // A card to split is one of the idle agents' roles: a part of another role's is no work for them.
  const idleRoles = new Set(starved.flatMap(each => each.roles));
  const worked = views
    .filter(view => view.owner && isWorked(view.state.status) && idleRoles.has(roleOf(view.task)))
    .map(view => view.task.id);
  const ways = [
    ...(backlog.length > 0
      ? [
          `stack the backlog's ${backlog.slice(0, 5).join(', ')}${backlog.length > 5 ? ` +${String(backlog.length - 5)}` : ''} as cards (a stage of tasks that close them: plitzi run open <stage.json>)`
        ]
      : []),
    ...(worked.length > 0
      ? [`split a large card still worked (${worked.join(', ')}) and hand a part (plitzi run amend)`]
      : [])
  ];
  // With nothing to give, what is left of their roles waits for a review or for work under way: the lead is told only of
  // a step it says — a run's lead was told to "decide" the reviews its tester held.
  const wholeTeam = reviewTeamOfAgents(team);
  const leadDecides = views.some(view => {
    const role = idleRoles.has(roleOf(view.task)) ? stepRole(view, wholeTeam) : undefined;

    return role !== undefined && stepReviewers(view, views, role, wholeTeam).includes(LEAD);
  });
  if (ways.length === 0 && !leadDecides) {
    return [];
  }

  const onDemand = new Set(running.filter(each => each.onDemand).map(each => each.agent));

  return [
    {
      kind: 'idle-team',
      // Said again only when other agents go idle, not when a card is done or the advice's words change.
      subject: names.join(','),
      text: `${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} nothing to take — keep the board ahead of the team: ${
        ways.length > 0
          ? ways.join('; or ')
          : `nothing is left to give: ${names.some(name => onDemand.has(name)) ? 'one on demand stops by itself, ' : ''}the rest wait for their reviews — decide those first`
      }`,
      who: 'lead'
    }
  ];
};
