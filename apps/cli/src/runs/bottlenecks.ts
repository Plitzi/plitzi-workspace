import { LEAD } from './messages';
import { DESIGNER, DEVELOPER } from './team';
import { isWorked } from './worked';

import type { TaskView } from './taskStore';
import type { StartedAgent } from './team';
import type { Attention } from './view';

/** A review taken this long and not decided, while nobody else has work, is the lead's to chase. */
const LONG_REVIEW_MINUTES = 10;

/** Where a task another waits for is held past its work — in a review, sent back, blocked — or nothing while it is worked. */
const heldIn = (view: TaskView): string | undefined =>
  view.state.status === 'in-review'
    ? view.state.design?.status === 'due'
      ? 'UI review'
      : 'lead review'
    : view.state.status === 'changes-requested'
      ? `sent back, round ${String(view.state.round)}`
      : view.state.status === 'blocked'
        ? 'blocked'
        : undefined;

/**
 * What holds the run's work back that only the lead can free: UI reviews no designer is free to take, and a task that
 * could start held behind others in review while agents of its role have nothing to take — each with the way out.
 */
export const bottlenecks = (views: readonly TaskView[], started: readonly StartedAgent[], now: Date): Attention[] => {
  const found: Attention[] = [];
  const byId = new Map(views.map(view => [view.task.id, view] as const));
  const approvedIds = new Set(views.filter(view => view.state.status === 'done').map(view => view.task.id));
  // UI reviews nobody takes: every designer is at a task of its own — the lead's, or they wait for nobody.
  const designers = started.filter(each => each.roles.includes(DESIGNER)).map(each => each.agent);
  const atOwn = (agent: string): string | undefined =>
    views.find(view => view.owner?.agent === agent && isWorked(view.state.status))?.task.id;
  const uiWaiting = views.filter(
    view =>
      view.state.status === 'in-review' && view.state.design?.status === 'due' && view.state.design.by === undefined
  );
  if (uiWaiting.length > 0 && designers.length > 0 && designers.every(agent => atOwn(agent) !== undefined)) {
    found.push({
      kind: 'ui-waits',
      text: `${uiWaiting.map(view => view.task.id).join(', ')} wait for a UI review, and no designer is free (${designers.map(agent => `${agent} at ${String(atOwn(agent))}`).join(', ')}): start another designer (team.json's designers) — or review them yourself, UI included (both schemes, the phone width): plitzi task next --role lead --take, then --approve --skip-design lead`,
      who: 'lead'
    });
  }

  // A task that could start, held behind one going round its reviews while agents of its role sit free: the lead's to
  // unblock — la-velada's t-motion waited three rounds of t-boxer's UI review it needed nothing from, two developers idle.
  const reviewing = new Set(views.flatMap(view => (view.state.design?.by ? [view.state.design.by] : [])));
  const free = (role: string): string[] =>
    started
      .filter(each => each.roles.includes(role) && atOwn(each.agent) === undefined && !reviewing.has(each.agent))
      .map(each => each.agent);
  for (const view of views.filter(each => each.state.status === 'pending')) {
    const held = view.task.dependsOn.flatMap(id => {
      const other = byId.get(id);

      return other && heldIn(other) !== undefined ? [other] : [];
    });
    const role = view.task.role ?? DEVELOPER;
    // Free with a ready task of their role to take, they are not held: only free with nothing to take are they.
    const idle = views.some(each => each.state.status === 'ready' && (each.task.role ?? DEVELOPER) === role)
      ? []
      : free(role);
    const waitsOn = view.task.dependsOn.filter(id => !approvedIds.has(id));
    if (held.length === 0 || held.length !== waitsOn.length || idle.length === 0) {
      continue;
    }

    const shared = view.task.files.filter(file => held.some(other => other.task.files.includes(file)));
    found.push({
      kind: 'held-up',
      task: view.task.id,
      text: `${view.task.id} waits for ${held.map(other => `${other.task.id} (${String(heldIn(other))})`).join(', ')} while ${idle.join(', ')} ${idle.length === 1 ? 'is' : 'are'} free: ${
        shared.length === 0
          ? `they share no file — if ${view.task.id} needs nothing they make, take the dependency away and it starts now (its dependsOn in the plan, then plitzi run amend)`
          : `they share ${shared.join(', ')} — review ${held.map(other => other.task.id).join(', ')} first (plitzi task next --role lead --take), or settle what is left yourself`
      }`,
      who: 'lead'
    });
  }

  // A review taken and not decided while the team has nothing to take: the run waits on one agent, and only the lead
  // can ask it where it stands or decide it — velada-now's last task sat in a designer's review, five agents idle.
  const idleAll = views.some(view => view.state.status === 'ready')
    ? []
    : started.filter(each => atOwn(each.agent) === undefined && !reviewing.has(each.agent)).map(each => each.agent);
  for (const view of views.filter(each => each.state.status === 'in-review')) {
    const { design, reviewer } = view.state;
    const taken =
      design?.status === 'due' && design.by !== undefined && design.at !== undefined
        ? { by: design.by, at: design.at, what: 'UI review' }
        : reviewer?.round === view.state.round && reviewer.by !== LEAD
          ? { by: reviewer.by, at: reviewer.at, what: 'review' }
          : undefined;
    const minutes = taken ? Math.round((now.getTime() - Date.parse(taken.at)) / 60_000) : 0;
    if (!taken || minutes < LONG_REVIEW_MINUTES || idleAll.length === 0) {
      continue;
    }

    found.push({
      kind: 'slow-review',
      task: view.task.id,
      text: `${taken.by} has had ${view.task.id}'s ${taken.what} ${String(minutes)} min while ${idleAll.join(', ')} ${idleAll.length === 1 ? 'has' : 'have'} nothing to take: ask where it stands and for a decision now (plitzi task message @${taken.by} "…") — or decide it yourself: plitzi task look ${view.task.id}, then plitzi task review ${view.task.id} --approve${taken.what === 'UI review' ? ' --skip-design lead' : ''} | --changes "…"`,
      who: 'lead'
    });
  }

  return found;
};
