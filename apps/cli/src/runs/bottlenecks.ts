import { reviewTimeOf } from './design';
import { LEAD } from './messages';
import { busyIn } from './onDemand';
import { REVIEW_QUEUE_MS } from './reviewQueue';
import { DESIGNER, DEVELOPER, SCOUT, TESTER } from './team';
import { isWorked } from './worked';

import type { TaskView } from './taskStore';
import type { StartedAgent } from './team';
import type { Attention } from './view';

/** Where a task another waits for is held past its work — in a review, sent back, blocked — or nothing while it is worked. */
const heldIn = (view: TaskView): string | undefined =>
  view.state.status === 'in-review'
    ? view.state.design?.status === 'due'
      ? 'UI review'
      : 'review'
    : view.state.status === 'changes-requested'
      ? `sent back, round ${String(view.state.round)}`
      : view.state.status === 'blocked'
        ? 'blocked'
        : undefined;

/**
 * What holds the run's work back that only the lead can free: UI reviews no designer is free to take, and a task that
 * could start held behind others in review while agents of its role have nothing to take — each with the way out.
 */
export const bottlenecks = (
  views: readonly TaskView[],
  started: readonly StartedAgent[],
  now: Date,
  /** The project's backlog items still open that no task of the run does: work the lead can stack. */
  backlog: readonly string[] = [],
  /**
   * The whole team, running or not: whether it has testers and scouts — `started` holds only those running, and a scout
   * stopped between two pieces read as none (encore-10's spike told the lead "the team has no scout").
   */
  team: readonly StartedAgent[] = started
): Attention[] => {
  const found: Attention[] = [];
  // Who reviews and who finds out: the team's testers and scouts — the lead, manager, only when it has none.
  const testers = team.some(each => each.roles.includes(TESTER));
  const scouts = team.some(each => each.roles.includes(SCOUT));
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
  // One waiting past the queue's time is the lead's to review now, free designer or not: the run's time is its tasks'.
  const queued = uiWaiting.filter(
    view => now.getTime() - Date.parse(view.state.design?.since ?? view.state.updatedAt) >= REVIEW_QUEUE_MS
  );
  // With testers, a UI review queued past its time is a tester's to take with the task (`uiQueued`): nothing for the lead.
  if (queued.length > 0 && !testers) {
    found.push({
      kind: 'ui-queued',
      text: `${queued.map(view => `${view.task.id} (${String(Math.round((now.getTime() - Date.parse(view.state.design?.since ?? view.state.updatedAt)) / 60_000))} min)`).join(', ')} ${queued.length === 1 ? 'has' : 'have'} waited past ${String(REVIEW_QUEUE_MS / 60_000)} min for a UI review nobody took: review ${queued.length === 1 ? 'it' : 'them'} yourself now, UI included (both schemes, the phone width) — plitzi task look ${queued[0].task.id}, then plitzi task review ${queued[0].task.id} --approve --skip-design reviewer | --changes "…"`,
      who: 'lead'
    });
  }

  if (
    uiWaiting.length > 0 &&
    !testers &&
    designers.length > 0 &&
    designers.every(agent => atOwn(agent) !== undefined)
  ) {
    found.push({
      kind: 'ui-waits',
      text: `${uiWaiting.map(view => view.task.id).join(', ')} wait for a UI review, and no designer is free (${designers.map(agent => `${agent} at ${String(atOwn(agent))}`).join(', ')}): start another designer (team.json's designers) — or review them yourself, UI included (both schemes, the phone width): plitzi task next --role lead --no-wait, then plitzi task review <task> --approve --skip-design reviewer`,
      who: 'lead'
    });
  }

  // A task that could start, held behind one going round its reviews while agents of its role sit free: the lead's to
  // unblock — a run's t-motion waited three rounds of t-boxer's UI review it needed nothing from, two developers idle.
  // At a review of its own or a spike — never free (encore-10's scout read "nothing to take" at its spike).
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
          ? `they share no file — if ${view.task.id} needs nothing they make (no action, data or module it calls: a page that asks their server action needs it there), take the dependency away and it starts now (its dependsOn in the plan, then plitzi run amend)`
          : `they share ${shared.join(', ')} — review ${held.map(other => other.task.id).join(', ')} first (plitzi task next --role lead --no-wait), or settle what is left yourself`
      }`,
      who: 'lead'
    });
  }

  // A review taken and not decided while the team has nothing to take: the run waits on one agent, and only the lead
  // can ask it where it stands or decide it — a run's last task sat in a designer's review, five agents idle.
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
    const held = taken ? now.getTime() - Date.parse(taken.at) : 0;
    const time = reviewTimeOf(taken?.what === 'UI review' ? design : undefined);
    // Past the review's time it is no longer its reviewer's, idle team or not; under it, only while others sit free.
    const past = held >= time;
    if (!taken || (!past && (held < time / 2 || idleAll.length === 0))) {
      continue;
    }

    const minutes = Math.round(held / 60_000);
    found.push({
      kind: 'slow-review',
      task: view.task.id,
      // The lead manages: with testers, it asks — the review stays a tester's, escalated to it if it cannot decide.
      text: testers
        ? `${taken.by} has held ${view.task.id}'s ${taken.what} ${String(minutes)} min${past ? `, past the ${String(time / 60_000)} a review takes` : ` while ${idleAll.join(', ')} ${idleAll.length === 1 ? 'has' : 'have'} nothing to take`}: ask where it stands and for its verdict — plitzi task message @${taken.by} "…" — or that it escalates what it cannot decide`
        : past
          ? `${taken.by} has held ${view.task.id}'s ${taken.what} ${String(minutes)} min, past the ${String(time / 60_000)} a review is its reviewer's: ${taken.what === 'UI review' ? 'the next designer free takes it — or ' : ''}decide it yourself now: plitzi task look ${view.task.id}, then plitzi task review ${view.task.id} --approve${taken.what === 'UI review' ? ' --skip-design reviewer' : ''} | --changes "…"`
          : `${taken.by} has had ${view.task.id}'s ${taken.what} ${String(minutes)} min while ${idleAll.join(', ')} ${idleAll.length === 1 ? 'has' : 'have'} nothing to take: ask where it stands and for a decision now (plitzi task message @${taken.by} "…") — or decide it yourself: plitzi task look ${view.task.id}, then plitzi task review ${view.task.id} --approve${taken.what === 'UI review' ? ' --skip-design reviewer' : ''} | --changes "…"`,
      who: 'lead'
    });
  }

  found.push(...idleTeam(views, started, backlog));

  // A spike is a scout's, its result the lead's to approve (a proposal, said apart); with no scout the lead finds it out.
  const spikes = views.filter(view => view.state.status === 'spike' && view.state.proposed === undefined);
  if (spikes.length > 0 && !scouts) {
    found.push({
      kind: 'spikes',
      text: `${spikes.map(view => `${view.task.id} (${view.task.spike ?? 'what it needs'})`).join('; ')} ${spikes.length === 1 ? 'is' : 'are'} in spike, yours to find out (the team has no scout) — look, check, measure (beside the site it copies, when it copies one) — then plitzi task spike <spike> --done "what was found" [--tasks <stage.json>]`,
      who: 'lead'
    });
  }

  return found;
};

/**
 * The run as a kanban: the lead keeps every agent busy. An agent running with nothing of its own being worked, no review
 * in hand and no card of its roles ready is starved — said to the lead with the way to feed it: the backlog's items no
 * task does yet, a card a designer could review the UI of, a large card to split; with nothing left, that it may go.
 * Three cards for two agents, each agent waited its own verdicts with nothing to take, the designer idle
 * nine minutes beside two cards in review whose UI looks the lead had kept.
 */
export const idleTeam = (
  views: readonly TaskView[],
  /** The team's agents running now. */
  running: readonly StartedAgent[],
  backlog: readonly string[]
): Attention[] => {
  if (views.length === 0 || views.every(view => view.state.status === 'done')) {
    return [];
  }

  const busy = new Set(views.flatMap(busyIn));
  const readyFor = (roles: readonly string[]): boolean =>
    views.some(view => view.state.status === 'ready' && roles.includes(view.task.role ?? DEVELOPER));
  // A designer while others' work is under way waits for its UI reviews, which is what it is for — and waiting costs
  // nothing: a run's idle-team told the lead to split a developer's card for the run's only UI reviewer.
  const uiComing = views.some(
    view => view.owner && isWorked(view.state.status) && (view.task.role ?? DEVELOPER) !== DESIGNER
  );
  // An agent none of whose role's cards is left has done its part: a run's lead was woken eight times at the end, for
  // developers with nothing of theirs left and a tester's spec it could not split for them.
  const leftFor = (roles: readonly string[]): boolean =>
    views.some(view => view.state.status !== 'done' && roles.includes(view.task.role ?? DEVELOPER));
  const starved = running.filter(
    each =>
      !busy.has(each.agent) &&
      !readyFor(each.roles) &&
      leftFor(each.roles) &&
      !(uiComing && each.roles.includes(DESIGNER))
  );
  if (starved.length === 0) {
    return [];
  }

  const names = starved.map(each => each.agent);
  const designer = starved.find(each => each.roles.includes(DESIGNER));
  // In review with no UI look offered — kept by the lead, or skipped — while a designer who did not write it is free.
  const lookable = designer
    ? views.filter(
        view =>
          view.state.status === 'in-review' &&
          view.state.design?.status !== 'due' &&
          view.owner?.agent !== designer.agent
      )
    : [];
  // A card to split is one of the idle agents' roles: a part of another role's is no work for them.
  const idleRoles = new Set(starved.flatMap(each => each.roles));
  const worked = views
    .filter(view => view.owner && isWorked(view.state.status) && idleRoles.has(view.task.role ?? DEVELOPER))
    .map(view => view.task.id);
  const ways = [
    ...(backlog.length > 0
      ? [
          `stack the backlog's ${backlog.slice(0, 5).join(', ')}${backlog.length > 5 ? ` +${String(backlog.length - 5)}` : ''} as cards (a stage of tasks that close them: plitzi run extend <stage.json>)`
        ]
      : []),
    ...(designer && lookable.length > 0
      ? [
          `give ${designer.agent} the UI of ${lookable.map(view => view.task.id).join(', ')} — approve without skipping its design review (no plitzi task review <task> --skip-design reviewer), and the next look is offered to it`
        ]
      : []),
    ...(worked.length > 0
      ? [`split a large card still worked (${worked.join(', ')}) and hand a part (plitzi run amend)`]
      : [])
  ];
  const onDemand = new Set(running.filter(each => each.onDemand).map(each => each.agent));

  return [
    {
      kind: 'idle-team',
      // Said again only when other agents go idle or a card is done, not when the advice's words change.
      subject: `${names.join(',')}:${String(views.filter(view => view.state.status === 'done').length)}`,
      text: `${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} nothing to take — keep the board ahead of the team: ${
        ways.length > 0
          ? ways.join('; or ')
          : `nothing is left to give: ${names.some(name => onDemand.has(name)) ? 'one on demand stops by itself, ' : ''}the rest wait for their reviews — decide those first`
      }`,
      who: 'lead'
    }
  ];
};
