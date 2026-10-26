import { commandAs } from './identity';
import { noTesterFor, spareReviewers, testerReviews } from './leads';
import { isResearch } from './spike';
import { DESIGNER, DEVELOPER, SCOUT, TESTER } from './team';
import { TASKS_PER_AGENT } from './teamNotices';
import { isWorked } from './worked';

import type { TaskView } from './taskStore';
import type { StartedAgent } from './team';
import type { Attention } from './view';

/**
 * Agents on demand: a team's group past its `min` is not started with the run, but when work waits for it — a task of
 * its role ready, a UI review no designer is free for — and it stops once none is left. A run
 * spends the tokens of the agents its work asks for, not of the team it could have.
 */

/** How long an agent on demand waits with nothing for it before it is told to stop: the lead starts it again. */
export const ON_DEMAND_IDLE_MS = 4 * 60_000;

/** How long an agent that starts with the run is given to join before the lead is told to start it. */
export const STARTING_MS = 2 * 60_000;

/** What brings an agent back after it stopped: a session of it asking for work, or taking some. */
const BACK_FOR_WORK: ReadonlySet<string> = new Set([
  'joined',
  'waiting',
  'take',
  'review-taken',
  'question-taken',
  'spike-taken'
]);

/**
 * Who said it stops and has not come back for work since, by the run's log: what an agent says on its way out — a
 * notice, a tell — after its stop is no sign of life (a run's test-1 and designers read "no signal" for half an hour
 * after a notice sent past their stop).
 */
export const stoppedAgents = (log: readonly Record<string, unknown>[]): Set<string> => {
  const stopped = new Set<string>();
  for (const entry of log) {
    // Started again — by the keeper or a lead, after a stop for a fresh context — it runs from its launch, before its
    // first command: until then a base agent read "stopped" while it was already at work (a run's design-1).
    if (entry.action === 'launch' && typeof entry.agent === 'string') {
      stopped.delete(entry.agent);

      continue;
    }

    if (typeof entry.by !== 'string') {
      continue;
    }

    if (entry.action === 'stops') {
      stopped.add(entry.by);
    } else if (BACK_FOR_WORK.has(String(entry.action))) {
      stopped.delete(entry.by);
    }
  }

  return stopped;
};

/** Who of the team is running now, by the run's log: any agent that said something and has not stopped since. */
export const runningAgents = (log: readonly Record<string, unknown>[]): Set<string> => {
  const stopped = stoppedAgents(log);

  return new Set(log.flatMap(entry => (typeof entry.by === 'string' && !stopped.has(entry.by) ? [entry.by] : [])));
};

/**
 * What holds an agent now: the task it works, the UI review it took, the review it took this round (a tester's), the
 * spike it finds out (a scout's).
 */
const busyIn = (view: TaskView): string[] => [
  ...(view.owner && isWorked(view.state.status) ? [view.owner.agent] : []),
  ...(view.state.design?.status === 'due' && view.state.design.by ? [view.state.design.by] : []),
  ...(view.state.status === 'in-review' && view.state.reviewer?.round === view.state.round
    ? [view.state.reviewer.by]
    : []),
  ...(toFind(view) && view.state.spikedBy ? [view.state.spikedBy.by] : [])
];

/**
 * A spike still to find out: a research task, or a task at work blocked on a question — a scout's. One whose result
 * waits for the lead's approval is the lead's now: its scout holds nothing.
 */
const toFind = (view: TaskView): boolean =>
  view.state.proposed === undefined &&
  ((view.state.status === 'spike' && isResearch(view.task)) ||
    (view.state.status === 'blocked' && view.state.blockedBy?.spike !== undefined));

/**
 * A review a tester takes that nobody took this round, not escalated to the lead: its UI said — or waiting for a designer
 * none is free for, which the tester reviews too.
 */
const untakenReview = (view: TaskView, noDesignerFree: boolean, testers: readonly string[]): boolean =>
  view.state.status === 'in-review' &&
  // One every tester worked is another's (`spareReviewers`, `leadReviews`): a tester started for it would refuse it.
  !noTesterFor(view, testers) &&
  (view.state.design?.status !== 'due' || (noDesignerFree && view.state.design.by === undefined)) &&
  testerReviews(view.task) &&
  (view.state.reviewer === undefined || view.state.reviewer.round !== view.state.round);

/**
 * What waits for each role with no running agent of it free to take it — and, of the agents on demand not running, the
 * one to start for it, with its command: for the lead to start, as `run watch` says.
 */
export const agentsNeeded = (
  views: readonly TaskView[],
  started: readonly StartedAgent[],
  running: ReadonlySet<string>,
  run: {
    identified: readonly string[];
    scratch: string;
    openFor: number;
    open: boolean;
    /**
     * The team says how to start its agents (`options.launch`): the run's keeper starts them, at once — a base agent is
     * given no time to be started by hand (a run's keeper waited two minutes while its lead was told to start dev-1).
     */
    launches?: boolean;
  }
): Attention[] => {
  // Given to the lead, who starts the base by hand: with the team's launch, the keeper starts it the moment the run opens.
  const startingFor = run.launches === true ? 0 : STARTING_MS;
  // How to start one: in the team's own harness, or the one the lead names.
  const launch = (agent: string): string =>
    `plitzi run agent ${agent} --launch${run.launches === true ? '' : ' --harness <yours>'}`;
  const busy = new Set(views.flatMap(busyIn));
  const roles = [...new Set(started.flatMap(each => each.roles))];
  // Every designer at work, or none in the team: a UI review waits for nobody — the tester takes it, as `task next`
  // offers it (`noDesignerFreeIn`). A designer not running is started for it instead.
  const noDesignerFree = started.filter(each => each.roles.includes(DESIGNER)).every(each => busy.has(each.agent));
  const testers = started.filter(each => each.roles.includes(TESTER)).map(each => each.agent);
  const reviewTeam = {
    testers,
    developers: started
      .filter(each => each.roles.includes(DEVELOPER) && !each.roles.includes(TESTER))
      .map(each => each.agent)
  };
  // A review no tester may take, untaken, and none of the developers that may review it running and free: one of them is
  // started for it — the lead reviews it only when nobody else may (`leadReviews`).
  const spareWaiting = views.flatMap(view => {
    const spare =
      view.state.status === 'in-review' &&
      view.state.design?.status !== 'due' &&
      (view.state.reviewer === undefined || view.state.reviewer.round !== view.state.round)
        ? spareReviewers(view, views, reviewTeam)
        : [];

    return spare.length > 0 && !spare.some(agent => running.has(agent) && !busy.has(agent))
      ? [{ task: view.task.id, spare }]
      : [];
  });
  const asked = new Set<string>();
  // A task sent back waits for its own agent alone, and nobody else takes it: one not running is asked for by name — an
  // agent stops between two pieces of work for a fresh context (`SessionMode`), before its review says. So does one
  // whose escalated review the lead answered (`task unblock --answer`): back in progress, its agent stopped at complete.
  const sentBack = new Map<string, string[]>();
  const unblocked = new Set<string>();
  for (const view of views) {
    const owner = view.owner?.agent;
    if (view.state.status === 'in-progress') {
      unblocked.add(view.task.id);
    }

    if (owner && isWorked(view.state.status) && !running.has(owner) && started.some(each => each.agent === owner)) {
      sentBack.set(owner, [...(sentBack.get(owner) ?? []), view.task.id]);
    }
  }

  // A spike its scout holds — sent back by the lead — waits for that scout, as a task for its agent: one not running is
  // asked for by name.
  const heldSpikes = new Map<string, string[]>();
  for (const view of views) {
    const holder = view.state.spikedBy?.by;
    if (holder && toFind(view) && !running.has(holder) && started.some(each => each.agent === holder)) {
      heldSpikes.set(holder, [...(heldSpikes.get(holder) ?? []), view.task.id]);
    }
  }

  const backToScout = [...heldSpikes].map(([agent, spikes]): Attention => {
    asked.add(agent);

    return {
      kind: 'agents-needed' as const,
      agent,
      text: `${spikes.join(', ')} ${spikes.length === 1 ? 'waits' : 'wait'} for ${agent}, which holds ${spikes.length === 1 ? 'it' : 'them'} and is not running: start it again — ${launch(agent)} (its prompt alone: plitzi run agent ${agent}) — it takes ${spikes.length === 1 ? 'it' : 'them'} first`,
      who: 'lead' as const
    };
  });

  const backTo = [...sentBack].map(([agent, tasks]): Attention => {
    asked.add(agent);

    return {
      kind: 'agents-needed' as const,
      agent,
      text: `${tasks.join(', ')} ${tasks.length === 1 ? 'was' : 'were'} ${tasks.some(task => unblocked.has(task)) ? 'handed back (unblocked, or sent back)' : 'sent back'} to ${agent}, which is not running: start it again — ${launch(agent)} (its prompt alone: plitzi run agent ${agent}) — it takes ${tasks.length === 1 ? 'it' : 'them'} first`,
      who: 'lead' as const
    };
  });

  const byRole = [
    ...roles.flatMap(role => {
      // Free to take work of the role: running, at nothing — and, for a UI review, not the one who wrote the task.
      // A designer is held for the UI reviews while others work (`task next` hands it none of its own then): it is no
      // free developer — a run's four ready tasks waited, two designers counted free for them.
      const freeOf = (except?: string) =>
        started.filter(
          each =>
            each.roles.includes(role) &&
            (role === 'designer' || !each.roles.includes('designer')) &&
            running.has(each.agent) &&
            !busy.has(each.agent) &&
            each.agent !== except
        );
      const ready = views
        .filter(view => !view.owner && view.state.status === 'ready')
        .filter(view => (view.task.role ?? 'developer') === role)
        .map(view => view.task.id);
      const reviews =
        role === DESIGNER
          ? views
              .filter(
                view =>
                  view.state.status === 'in-review' && view.state.design?.status === 'due' && !view.state.design.by
              )
              .filter(view => freeOf(view.owner?.agent).length === 0)
              .map(view => `the UI of ${view.task.id}`)
          : role === TESTER
            ? views
                .filter(view => untakenReview(view, noDesignerFree, testers) && freeOf(view.owner?.agent).length === 0)
                .map(view => `the review of ${view.task.id}`)
            : role === SCOUT && freeOf().length === 0
              ? views
                  .filter(view => toFind(view) && view.state.spikedBy === undefined)
                  .map(view => `the spike ${view.task.id}`)
              : role === DEVELOPER
                ? spareWaiting.map(each => `the review of ${each.task} (each tester worked it)`)
                : [];
      // For those reviews alone, only a developer that may give them: one that worked the task is refused it.
      const mayReview = new Set(spareWaiting.flatMap(each => each.spare));
      const forReviewsAlone = role === DEVELOPER && reviews.length > 0 && !(freeOf().length === 0 && ready.length > 0);
      const waiting = [...(freeOf().length === 0 ? ready : []), ...reviews];
      // The team's order: one that starts with the run first, then those on demand — never dev-2 while dev-1 is not running.
      // With one of the role running, only an agent on demand is asked for: the rest are the lead's to start at the open.
      const ofRole = (each: StartedAgent) =>
        each.roles.includes(role) && (role === 'designer' || !each.roles.includes('designer'));
      const anyRunning = started.some(each => ofRole(each) && running.has(each.agent));
      const startable = (fits: (each: StartedAgent) => boolean): StartedAgent | undefined =>
        started.find(
          each =>
            fits(each) &&
            !running.has(each.agent) &&
            !asked.has(each.agent) &&
            // One of the base not running is asked for below, whatever waits (`base`).
            (each.onDemand === true || !anyRunning)
        );
      // For those reviews, any that may give them — one that designs too, which `ofRole` leaves to the designers.
      const reviewer = (each: StartedAgent): boolean => mayReview.has(each.agent);
      const next = forReviewsAlone
        ? startable(reviewer)
        : (startable(ofRole) ?? (role === DEVELOPER && reviews.length > 0 ? startable(reviewer) : undefined));
      // One that starts with the run is being started as the run opens: asked for only once it had time to join —
      // A run's watch said "start dev-1" the moment the lead had started it.
      if (waiting.length === 0 || !next || (!next.onDemand && run.openFor < startingFor)) {
        return [];
      }

      // One on demand beside those running is worth its start when the work waiting and in hand, shared with it, is
      // TASKS_PER_AGENT each or more — as `run plan` counts it: fewer, those running take it next. A run's watch asked
      // for dev-2 for two tasks the plan had said were too few for three agents.
      const runningOfRole = started.filter(each => ofRole(each) && running.has(each.agent));
      const inHand = runningOfRole.filter(each => busy.has(each.agent)).length;
      // A task of the role that waits only for work under way is work coming: a run's t-buybox waited for
      // t-description alone, and four cards for one developer (~145 min) never asked for the second.
      const byId = new Map(views.map(view => [view.task.id, view]));
      const coming = views.filter(
        view =>
          !view.owner &&
          view.state.status === 'pending' &&
          (view.task.role ?? 'developer') === role &&
          view.task.dependsOn.length > 0 &&
          view.task.dependsOn.every(id => {
            const dependency = byId.get(id);

            return (
              dependency !== undefined && (dependency.state.status === 'done' || isWorked(dependency.state.status))
            );
          })
      ).length;
      // A UI review no designer running may make — its own author's — waits for another whatever the count.
      if (
        next.onDemand &&
        anyRunning &&
        reviews.length === 0 &&
        (waiting.length + inHand + coming) / (runningOfRole.length + 1) < TASKS_PER_AGENT
      ) {
        return [];
      }

      asked.add(next.agent);

      return [
        {
          kind: 'agents-needed' as const,
          agent: next.agent,
          text: `${waiting.join(', ')} ${waiting.length === 1 ? 'waits' : 'wait'} for a ${role}, and none running is free: start ${next.agent}${next.onDemand ? ', on demand' : ''} — ${launch(next.agent)} (its prompt alone: plitzi run agent ${next.agent}; by hand: ${commandAs(run.scratch, next.agent, run.identified, `task next${next.quality ? ` --quality ${next.quality}` : ''}`)})${next.onDemand ? ` — it stops by itself once nothing is left for it; its start costs about a small task, worth it for ${String(TASKS_PER_AGENT)} or more waiting` : ''}`,
          who: 'lead' as const
        }
      ];
    })
  ];
  // The team's base runs while the run is open, idle when nothing is for it: one not running — stopped for a fresh
  // context, or its harness gone — is started again whatever waits (Carlos: "los agentes base, deben estar siempre activos").
  // Not before the run has a task for them: a run opened on its scope is the lead's spike, planned with the person,
  // and an agent started then would wait through all of it.
  const base =
    run.open && views.some(view => view.task.spike === undefined)
      ? started
          .filter(each => each.onDemand !== true && !running.has(each.agent) && !asked.has(each.agent))
          .filter(() => run.openFor >= startingFor)
          .map((each): Attention => ({
            kind: 'agents-needed' as const,
            agent: each.agent,
            text: `${each.agent}, of the team's base, is not running: start it again — ${launch(each.agent)} — it waits for work while the run is open`,
            who: 'lead' as const
          }))
      : [];

  return [...backTo, ...backToScout, ...byRole, ...base];
};

/**
 * The agents that start with the run, of `agent`'s roles, there and at nothing — what a task ready is theirs first:
 * an agent on demand is for the work the team's base cannot take, never before it (Carlos: "siempre comienza con el
 * agente base, y luego on-demand si es requerido, si este está libre"). A designer counts only for a designer.
 */
export const freeBaseAgents = (
  views: readonly TaskView[],
  started: readonly StartedAgent[],
  running: ReadonlySet<string>,
  present: ReadonlySet<string>,
  agent: string,
  roles: readonly string[]
): string[] => {
  const busy = new Set(views.flatMap(busyIn));
  const designer = roles.includes('designer');

  return started
    .filter(
      each =>
        each.agent !== agent &&
        each.onDemand !== true &&
        each.roles.some(role => roles.includes(role)) &&
        (designer || !each.roles.includes('designer')) &&
        running.has(each.agent) &&
        present.has(each.agent) &&
        !busy.has(each.agent)
    )
    .map(each => each.agent);
};
