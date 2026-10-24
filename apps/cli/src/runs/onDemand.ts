import { commandAs } from './identity';
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
 * notice, a tell — after its stop is no sign of life (encore-2's test-1 and designers read "no signal" for half an hour
 * after a notice sent past their stop).
 */
export const stoppedAgents = (log: readonly Record<string, unknown>[]): Set<string> => {
  const stopped = new Set<string>();
  for (const entry of log) {
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
 * What waits for each role with no running agent of it free to take it — and, of the agents on demand not running, the
 * one to start for it, with its command: for the lead to start, as `run watch --until lead` says.
 */
export const agentsNeeded = (
  views: readonly TaskView[],
  started: readonly StartedAgent[],
  running: ReadonlySet<string>,
  run: { identified: readonly string[]; scratch: string; openFor: number; open: boolean }
): Attention[] => {
  const busy = new Set(
    views.flatMap(view => [
      ...(view.owner && isWorked(view.state.status) ? [view.owner.agent] : []),
      ...(view.state.design?.status === 'due' && view.state.design.by ? [view.state.design.by] : [])
    ])
  );
  const roles = [...new Set(started.flatMap(each => each.roles))];
  const asked = new Set<string>();
  // A task sent back waits for its own agent alone, and nobody else takes it: one not running is asked for by name — an
  // agent stops between two pieces of work for a fresh context (`SessionMode`), before its review says.
  const sentBack = new Map<string, string[]>();
  for (const view of views) {
    const owner = view.owner?.agent;
    if (
      owner &&
      view.state.status === 'changes-requested' &&
      !running.has(owner) &&
      started.some(each => each.agent === owner)
    ) {
      sentBack.set(owner, [...(sentBack.get(owner) ?? []), view.task.id]);
    }
  }

  const backTo = [...sentBack].map(([agent, tasks]): Attention => {
    asked.add(agent);

    return {
      kind: 'agents-needed' as const,
      agent,
      text: `${tasks.join(', ')} ${tasks.length === 1 ? 'was' : 'were'} sent back to ${agent}, which is not running: start it again — plitzi run agent ${agent} --launch --harness <yours> (its prompt alone: plitzi run agent ${agent}) — it takes ${tasks.length === 1 ? 'it' : 'them'} first`,
      who: 'lead' as const
    };
  });

  const byRole = [
    ...roles.flatMap(role => {
      // Free to take work of the role: running, at nothing — and, for a UI review, not the one who wrote the task.
      // A designer is held for the UI reviews while others work (`task next` hands it none of its own then): it is no
      // free developer — velada-dress's four ready tasks waited, two designers counted free for them.
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
        role === 'designer'
          ? views
              .filter(
                view =>
                  view.state.status === 'in-review' && view.state.design?.status === 'due' && !view.state.design.by
              )
              .filter(view => freeOf(view.owner?.agent).length === 0)
              .map(view => `the UI of ${view.task.id}`)
          : [];
      const waiting = [...(freeOf().length === 0 ? ready : []), ...reviews];
      // The team's order: one that starts with the run first, then those on demand — never dev-2 while dev-1 is not running.
      // With one of the role running, only an agent on demand is asked for: the rest are the lead's to start at the open.
      const ofRole = (each: StartedAgent) =>
        each.roles.includes(role) && (role === 'designer' || !each.roles.includes('designer'));
      const anyRunning = started.some(each => ofRole(each) && running.has(each.agent));
      const next = started.find(
        each =>
          ofRole(each) &&
          !running.has(each.agent) &&
          !asked.has(each.agent) &&
          // One of the base not running is asked for below, whatever waits (`base`).
          (each.onDemand === true || !anyRunning)
      );
      // One that starts with the run is being started as the run opens: asked for only once it had time to join —
      // velada-fidelity's watch said "start dev-1" the moment the lead had started it.
      if (waiting.length === 0 || !next || (!next.onDemand && run.openFor < STARTING_MS)) {
        return [];
      }

      // One on demand beside those running is worth its start when the work waiting and in hand, shared with it, is
      // TASKS_PER_AGENT each or more — as `run plan` counts it: fewer, those running take it next. velada-shell's watch asked
      // for dev-2 for two tasks the plan had said were too few for three agents.
      const runningOfRole = started.filter(each => ofRole(each) && running.has(each.agent));
      const inHand = runningOfRole.filter(each => busy.has(each.agent)).length;
      // A task of the role that waits only for work under way is work coming: lx-product's t-buybox waited for
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
          text: `${waiting.join(', ')} ${waiting.length === 1 ? 'waits' : 'wait'} for a ${role}, and none running is free: start ${next.agent}${next.onDemand ? ', on demand' : ''} — plitzi run agent ${next.agent} --launch --harness <yours> (its prompt alone: plitzi run agent ${next.agent}; by hand: ${commandAs(run.scratch, next.agent, run.identified, `task next --role ${next.roles.join(',')}${next.quality ? ` --quality ${next.quality}` : ''} --follow --take`)})${next.onDemand ? ` — it stops by itself once nothing is left for it; its start costs about a small task, worth it for ${String(TASKS_PER_AGENT)} or more waiting` : ''}`,
          who: 'lead' as const
        }
      ];
    })
  ];
  // The team's base runs while the run is open, idle when nothing is for it: one not running — stopped for a fresh
  // context, or its harness gone — is started again whatever waits (Carlos: "los agentes base, deben estar siempre activos").
  const base = run.open
    ? started
        .filter(each => each.onDemand !== true && !running.has(each.agent) && !asked.has(each.agent))
        .filter(() => run.openFor >= STARTING_MS)
        .map((each): Attention => ({
          kind: 'agents-needed' as const,
          agent: each.agent,
          text: `${each.agent}, of the team's base, is not running: start it again — plitzi run agent ${each.agent} --launch --harness <yours> — it waits for work while the run is open`,
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
  const busy = new Set(
    views.flatMap(view => [
      ...(view.owner && isWorked(view.state.status) ? [view.owner.agent] : []),
      ...(view.state.design?.status === 'due' && view.state.design.by ? [view.state.design.by] : [])
    ])
  );
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
