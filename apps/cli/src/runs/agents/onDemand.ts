import { holdsOf } from './held';
import { commandAs } from './identity';
import { TESTER } from './team';
import { isWorked } from './worked';
import { roleOf } from '../plan/spike';
import { testWriters, writesTests } from '../plan/tests';
import { LEAD } from '../talk/messages';
import { reviewSteps, reviewTeamOfAgents, stepQueued, stepReviewers, stepRole } from '../tasks/reviews';

import type { StartedAgent } from './team';
import type { RunTask } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { Attention } from '../view/view';

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
const BACK_FOR_WORK: ReadonlySet<string> = new Set(['joined', 'waiting', 'take', 'review-taken', 'question-taken']);

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

/** Who a task holds busy now, whatever it holds them at (`held.ts`). */
export const busyIn = (view: TaskView): string[] => holdsOf(view).map(held => held.agent);

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
    /** Now, in ms: a step nobody took past its queue's time is the next step's reviewer's too. */
    now?: number;
  }
): Attention[] => {
  // Given to the lead, who starts the base by hand: with the team's launch, the keeper starts it the moment the run opens.
  const startingFor = run.launches === true ? 0 : STARTING_MS;
  // How to start one: in the team's own harness, or the one the lead names.
  const launch = (agent: string): string =>
    `plitzi run agent ${agent} --launch${run.launches === true ? '' : ' --harness <yours>'}`;
  /**
   * What starting it asks of the lead: with the team's launch the keeper starts it — said as the keeper's, and the
   * lead's command only if it does not come (a run's status told the lead to start scout-1 as the keeper started it).
   */
  const start = (agent: string, onDemand: boolean): string =>
    run.launches === true
      ? `the run's keeper starts ${agent}${onDemand ? ', on demand' : ''} — yours only if it does not come: ${launch(agent)}`
      : `start ${agent}${onDemand ? ', on demand' : ''} — ${launch(agent)}`;
  const busy = new Set(views.flatMap(busyIn));
  const roles = [...new Set(started.flatMap(each => each.roles))];
  const reviewTeam = reviewTeamOfAgents(started);
  // A task of tests is a developer's that worked none of what it tests; a tester's when no developer may.
  const roleFor = (task: RunTask): string =>
    task.testsOf !== undefined && testWriters(task, views, reviewTeam.developers).length === 0 ? TESTER : roleOf(task);
  // A step of a review nobody took, none of whose reviewers is running and free: one of them is started for it — the
  // lead says it only when nobody else may (`stepReviewers`).
  const reviewsWaiting = views.flatMap(view => {
    const role = stepRole(view, reviewTeam);
    const { review } = view.state;
    // Queued past its time, the next step's reviewer may say it too: one of them is started for it as well.
    const next = review === undefined ? undefined : reviewSteps(view.task, reviewTeam).at(review.step + 1);
    const queued =
      next !== undefined && run.now !== undefined && stepQueued(review, run.now)
        ? stepReviewers(view, views, next, reviewTeam)
        : [];
    const reviewers =
      role === undefined || review?.by !== undefined
        ? []
        : [...new Set([...stepReviewers(view, views, role, reviewTeam), ...queued])].filter(agent => agent !== LEAD);

    return reviewers.length > 0 && !reviewers.some(agent => running.has(agent) && !busy.has(agent))
      ? [{ task: view.task.id, role, reviewers }]
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
      // Ready for the role — a task of tests a tester's when no developer may write it (`spareTests`) — and taken by
      // none running and free: one that worked what a task of tests tests is no agent for it.
      const readyOf = views
        .filter(view => !view.owner && view.state.status === 'ready')
        .filter(view => roleFor(view.task) === role)
        .filter(view => !freeOf().some(each => writesTests(view.task, each.agent, views)));
      const ready = readyOf.map(view => view.task.id);
      // The reviews an agent of this role may say, waiting: a designer's look, a tester's QA, a developer's of one nobody
      // of its role may say.
      const ofThis = reviewsWaiting.filter(each =>
        each.reviewers.some(agent => started.some(member => member.agent === agent && member.roles.includes(role)))
      );
      const reviews = ofThis.map(each => `the ${each.role}'s review of ${each.task}`);
      // For those reviews alone, only an agent that may give them: one that worked the task is refused it.
      const mayReview = new Set(ofThis.flatMap(each => each.reviewers));
      const forReviewsAlone = reviews.length > 0 && ready.length === 0;
      const waiting = [...ready, ...reviews];
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
      // For the tasks waiting, one that may take one of them: a task of tests, never its author.
      const takesOne = (each: StartedAgent): boolean =>
        ofRole(each) && (readyOf.length === 0 || readyOf.some(view => writesTests(view.task, each.agent, views)));
      const next = forReviewsAlone
        ? startable(reviewer)
        : (startable(takesOne) ?? (reviews.length > 0 ? startable(reviewer) : undefined));
      // One that starts with the run is being started as the run opens: asked for only once it had time to join —
      // a run's watch said "start dev-1" the moment the lead had started it.
      if (waiting.length === 0 || !next || (!next.onDemand && run.openFor < startingFor)) {
        return [];
      }

      // Work waiting with none of its role free starts one on demand, up to the team's most: dividing the work is the
      // run's speed (Carlos). A ratio held it back — a run's two research cards waited behind the scope, three
      // scouts allowed and one running.
      asked.add(next.agent);

      return [
        {
          kind: 'agents-needed' as const,
          agent: next.agent,
          text: `${waiting.join(', ')} ${waiting.length === 1 ? 'waits' : 'wait'} for a ${role}, and none running is free: ${start(next.agent, next.onDemand === true)} (its prompt alone: plitzi run agent ${next.agent}; by hand: ${commandAs(run.scratch, next.agent, run.identified, `task next${next.quality ? ` --quality ${next.quality}` : ''}`)})${next.onDemand ? ' — it stops by itself once nothing is left for it' : ''}`,
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

  return [...backTo, ...byRole, ...base];
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
