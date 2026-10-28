import path from 'node:path';

import { bottlenecks } from './bottlenecks';
import { projectExec } from '../../scaffold/packageManager';
import { identifiedAgents } from '../agents/identity';
import { longTaskAttention } from '../agents/longTask';
import { agentsNeeded } from '../agents/onDemand';
import { agentsNow } from '../agents/running';
import { heldAhead, lockHolder, stalled } from '../agents/stalled';
import { readTeam, SCOUT, startedAgents, TESTER } from '../agents/team';
import { isWorked } from '../agents/worked';
import { previewPort } from '../copies/previewRecord';
import { leftInTmp } from '../copies/strays';
import { fingerprint } from '../core/files';
import { asksLead } from '../core/model';
import { under } from '../core/paths';
import { isDisconnected, readStart, viewTask } from '../core/taskStore';
import { liveAttention } from '../findings/live';
import { stackableBacklog } from '../plan/backlog';
import { isResearch, roleOf } from '../plan/spike';
import { chainMinutes, urgencies } from '../plan/urgency';
import { readHistory } from '../report/history';
import { settledFindings } from '../report/settle';
import { loadRun, pinDifference, pinnedNow, readApproved, readBase, readRunLog, runIds } from '../run';
import { proposalsOf } from '../talk/agreements';
import { LEAD, messagesOf, standingText, unreadFor } from '../talk/messages';
import { allLocks, requestsOf } from '../tasks';
import { leadStepWhy, reviewSteps, reviewTeamOfAgents, stepReviewers, stepRole } from '../tasks/reviews';

import type { Needs, Priority, RunRecord, TaskState, TaskStatus, Waiting } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { RunContext } from '../run';

/** How much of a message the run's view shows: one too long to scan is cut, and says where it is whole. */
const GLIMPSE = 400;

const glimpse = (text: string): string =>
  text.length <= GLIMPSE
    ? text
    : `${text.slice(0, GLIMPSE).trimEnd()}… (${String(text.length - GLIMPSE)} characters more in the inbox)`;

/**
 * What a run looks like at a glance: the same for a person in the terminal and for a harness as JSON,
 * whatever harness started it. Gathered by reading only — following a run writes nothing.
 */

export interface TaskLine {
  id: string;
  title: string;
  kind: 'work' | 'integration';
  role: string;
  status: TaskStatus;
  priority: string;
  /** How urgent it is: its own priority or that of any task waiting on it, whichever comes first (`effectiveRanks`). */
  urgency: Priority;
  agent?: string;
  step?: string;
  fraction?: number;
  round: number;
  files: string[];
  waitingFor?: Waiting;
  blockedBy?: { reason: string; needs: Needs };
  /** Why the lead took it out of the run (`task leave`). */
  left?: TaskState['left'];
  estimateMinutes: number;
  spentMinutes?: number;
  /** Only while it is worked: a task in review, blocked or waiting has no agent on it to be heard from. */
  noSignal: boolean;
  /** When its holder took it: a task done again after a revert is another review, though its round is the same. */
  takenAt?: string;
  /** The tasks that start when this one is done. */
  unblocks: string[];
  /** Pending: the tasks it waits for, not approved yet — what a person reads "pending" as. */
  waitsOn?: string[];
  /** When it last changed: how long it has been as it is. */
  updatedAt: string;
  milestone?: string;
  /**
   * In review: the step of its review it is at (`reviews.ts`) — its role, the card's steps, who took it, and who may say
   * it when nobody of its role may (developers that did not work it, or the lead alone: `lead`).
   */
  review?: {
    role: string;
    step: number;
    steps: string[];
    by?: string;
    reviewers: string[];
    lead?: true;
    /** Why its step is the lead's, when its role is the lead's. */
    why?: string;
  };
  /** When its holder was last heard from — a command, a heartbeat, a write in its copy. */
  signalAt?: string;
  /** In review: since when it is as it is — sent, or its UI said — what a review no lead takes has waited from. */
  since?: string;
  /** A research card not done: what it finds out. */
  spike?: string;
  /** How many findings its spikes left: a task the run researched. */
  found?: number;
  /** A research card ready in a team with no scout: the lead's to find out. */
  leadFindsOut?: true;
  /** A spike's tasks a scout proposes, waiting for the lead: by whom, and the tasks. */
  proposed?: { by: string; tasks: string[] };
  /**
   * At work, while its agent is at another of the tasks it holds — one at a time: that one. A task sent back while its
   * agent wrote the next one was on the board twice, its agent "ready" and "at work" at once.
   */
  parkedFor?: string;
  /** At work, held on a question its agent asked the lead and nobody answered: which, in a line. */
  asking?: { id: string; text: string; answered?: true };
}

export interface Attention {
  kind:
    | 'blocked'
    | 'no-signal'
    | 'long-wait'
    | 'long-task'
    | 'changed-in-project'
    | 'reconciliation'
    | 'stopping'
    | 'person'
    | 'request'
    | 'proposal'
    | 'overwrite'
    | 'known-failure'
    | 'version'
    | 'left-in-tmp'
    | 'review-waits'
    | 'held-up'
    | 'held-ahead'
    | 'slow-review'
    | 'idle-team'
    | 'agents-needed'
    | 'refused-again'
    | 'line-unanswered'
    | 'finding'
    | 'spikes'
    | 'spike-proposed'
    | 'stalled'
    | 'message';
  task?: string;
  /** The file it is about, when it is about one: what keeps it the same notice while its words change. */
  file?: string;
  /**
   * What else keeps it the same notice while its words change — idle agents and how far the board is: a run's lead
   * was woken eleven times for one idle designer, each time the cards its advice named changed.
   */
  subject?: string;
  /** A message to the lead: its id — and whether it is only to know, read once `run watch` showed it. */
  message?: string;
  fyi?: true;
  text: string;
  /** Who acts on it. */
  who: Needs;
  /** For an agent the run asks for (`agents-needed`): which — what `options.launch` starts by itself. */
  agent?: string;
  /** For a card past its limit (`long-task`): the agent the run asks where it stands, by itself (`askStandings`). */
  asks?: string;
  /** A message only to know that is still the lead's to decide on — a standing its agent answered: it wakes the lead. */
  decide?: true;
}

export interface RunView {
  runId: string;
  goal: string;
  status: RunRecord['status'];
  openedAt: string;
  activeOn: RunRecord['activeOn'];
  done: number;
  total: number;
  milestones: { name: string; done: number; total: number }[];
  /** When it should end, at this pace: the longest chain still to do from now. */
  expectedEnd?: string;
  /** The pace the expected end is read at: whose runs, and how far they took from their estimates. */
  pace?: { from: 'project' | 'machine'; ratio: number };
  tasks: TaskLine[];
  attention: Attention[];
  merges: { id: string; kind: string; at: string; files: number }[];
  approvedFiles: number;
  /** Who reviews the tasks: the team's testers — none, and the lead reviews every task. */
  reviewers: string[];
  /** The agents the CLI launched whose process has ended: not running, whatever the log's last word of them. */
  gone: string[];
  /** Where the run's approved work is served while a preview serves it (`run preview`, `npm run start:preview`). */
  previewPort?: number;
  /** The agents with a token on the run: started again by it, never by their name (`identity.ts`). */
  identified: string[];
  /** The run's scratch folder, whole: where each agent's token is kept (`RunPaths.scratch`). */
  scratch: string;
  /** Opened on a plan written before it: the lead's research is in no record of the run — the monitor says so. */
  scopedBefore?: true;
}

/** What a wait is on: a file, or an answer to a proposal. */
export const waitingText = (waiting: Waiting): string =>
  waiting.proposal ? `to answer ${waiting.proposal}` : `on ${waiting.file ?? 'a file'}`;

const minutesBetween = (from: string, to: Date): number => Math.round((to.getTime() - Date.parse(from)) / 60_000);

/** Past its work: in review or approved, what its agent last said of the work is history. */
const past = (view: TaskView): boolean => view.state.status === 'in-review' || view.state.status === 'done';

const lineOf = (view: TaskView, now: Date, owesSignal: boolean, unblocks: string[], urgency: Priority): TaskLine => ({
  id: view.task.id,
  title: view.task.title,
  kind: view.task.kind,
  role: roleOf(view.task),
  status: view.state.status,
  priority: view.task.priority,
  urgency,
  ...(view.owner ? { agent: view.owner.agent } : {}),
  // Where its work got to, while it is worked: in review, "waiting for t-boxer before check · 85 %" was no longer true.
  ...(view.progress?.step && !past(view) ? { step: view.progress.step } : {}),
  ...(view.progress?.fraction !== undefined && !past(view) ? { fraction: view.progress.fraction } : {}),
  round: view.state.round,
  files: view.task.files,
  updatedAt: view.state.updatedAt,
  ...(view.state.waitingFor ? { waitingFor: view.state.waitingFor } : {}),
  ...(view.state.blockedBy ? { blockedBy: view.state.blockedBy } : {}),
  ...(view.state.left ? { left: view.state.left } : {}),
  estimateMinutes: view.task.estimateMinutes,
  ...(view.owner ? { spentMinutes: minutesBetween(view.owner.takenAt, now) } : {}),
  noSignal: owesSignal && isWorked(view.state.status) && isDisconnected(view.task, view.signalAt, now),
  ...(view.owner ? { takenAt: view.owner.takenAt } : {}),
  ...(view.state.status === 'in-review' ? { since: view.state.updatedAt } : {}),
  ...(view.owner && view.signalAt !== undefined ? { signalAt: new Date(view.signalAt).toISOString() } : {}),
  unblocks,
  ...(view.task.milestone ? { milestone: view.task.milestone } : {}),
  ...(isResearch(view.task) && view.state.status !== 'done' ? { spike: view.task.spike ?? 'what it needs' } : {}),
  ...(view.state.findings && view.state.findings.length > 0 ? { found: view.state.findings.length } : {}),
  ...(view.state.proposed ? { proposed: { by: view.state.proposed.by, tasks: view.state.proposed.tasks } } : {})
});

/**
 * Written or written again, nothing asked: what an agent can be at, of the tasks in hand — one waiting, blocked or on a
 * question to the lead is held, not at work.
 */
const isAtWork = (line: TaskLine): boolean =>
  (line.status === 'in-progress' || line.status === 'changes-requested') && !line.asking;

/** The task each agent is at, of those it holds at work: the one it last did something on itself. */
const agentsAt = (lines: readonly TaskLine[], views: readonly TaskView[]): Map<string, string> => {
  const workedAt = new Map(views.map(view => [view.task.id, view.workedAt ?? 0] as const));
  const at = new Map<string, TaskLine>();
  for (const line of lines.filter(isAtWork)) {
    const was = line.agent === undefined ? undefined : at.get(line.agent);
    if (line.agent !== undefined && (!was || (workedAt.get(line.id) ?? 0) > (workedAt.get(was.id) ?? 0))) {
      at.set(line.agent, line);
    }
  }

  return new Map([...at].map(([agent, line]) => [agent, line.id] as const));
};

/** Each agent's tasks at work but the one it is at, said to wait for that one (`parkedFor`). */
const parked = (lines: readonly TaskLine[], views: readonly TaskView[]): TaskLine[] => {
  const atOf = agentsAt(lines, views);

  return lines.map(line => {
    const at = line.agent === undefined ? undefined : atOf.get(line.agent);

    return at !== undefined && at !== line.id && isAtWork(line) ? { ...line, parkedFor: at } : line;
  });
};

export const viewRun = async (ctx: RunContext, runId: string): Promise<RunView> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const now = ctx.now();
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const byId = new Map(views.map(view => [view.task.id, view]));
  const approvedIds = new Set(views.filter(view => view.state.status === 'done').map(view => view.task.id));
  const urgency = urgencies(loaded.tasks);
  const team = await readTeam(ctx.root).catch(() => undefined);
  const started = team ? startedAgents(team) : [];
  const testers = started.filter(each => each.roles.includes(TESTER)).map(each => each.agent);
  const reviewTeam = reviewTeamOfAgents(started);
  const scouting = started.some(each => each.roles.includes(SCOUT));
  const log = await readRunLog(loaded.paths);
  const { gone, starting, running } = await agentsNow(loaded.paths, views, team, log, now);
  // A task sent back — or unblocked — to an agent not running waits for it to be started, and the lead is told that
  // (`agentsNeeded`): "no signal — reassign it" beside it contradicted it (t-room-read's dev-2).
  const owesSignal = (view: TaskView): boolean =>
    view.owner !== undefined &&
    !starting.has(view.owner.agent) &&
    (running.has(view.owner.agent) || !started.some(each => each.agent === view.owner?.agent));
  const lines = views.map(view => {
    const line = lineOf(
      view,
      now,
      owesSignal(view),
      loaded.tasks.filter(task => task.dependsOn.includes(view.task.id)).map(task => task.id),
      urgency.get(view.task.id) ?? view.task.priority
    );
    const waitsOn = view.task.dependsOn.filter(id => !approvedIds.has(id));
    const role = stepRole(view, reviewTeam);
    const reviewers = role === undefined ? [] : stepReviewers(view, views, role, reviewTeam);
    const review =
      role === undefined || view.state.review === undefined
        ? undefined
        : {
            role,
            step: view.state.review.step,
            steps: reviewSteps(view.task, reviewTeam),
            ...(view.state.review.by === undefined ? {} : { by: view.state.review.by }),
            reviewers,
            ...(reviewers.includes(LEAD) ? { lead: true as const } : {}),
            ...(role === LEAD ? { why: leadStepWhy(view.task, reviewTeam) } : {})
          };

    return {
      ...line,
      ...(view.state.status === 'pending' && waitsOn.length > 0 ? { waitsOn } : {}),
      ...(review ? { review } : {}),
      ...(isResearch(view.task) && view.state.status === 'ready' && !scouting ? { leadFindsOut: true as const } : {})
    };
  });
  // A task sent back to an agent at another one waits for it, as the run means it to: its silence is no "no signal —
  // reassign it" while its agent works the one it is at.
  const waitingItsAgent = new Set(
    parked(lines, views)
      .filter(line => line.parkedFor !== undefined)
      .map(line => line.id)
  );
  const tasks = lines.map(line => (waitingItsAgent.has(line.id) ? { ...line, noSignal: false } : line));
  const attention: Attention[] = [];
  const { record } = loaded;
  if (record.status === 'reconciliation') {
    attention.push({
      kind: 'reconciliation',
      text: `In reconciliation: ${record.reconciliation?.reason ?? ''} — ${record.reconciliation?.files.map(file => `${file.file}${file.resolved ? ` (${file.resolved})` : ''}`).join(', ') ?? ''}`,
      who: 'person'
    });
  }

  // Read with any version, so the lead sees it: until a person re-pins the run, every agent's command is refused.
  const { stops, carried } = await pinDifference(ctx.root, record.pinned, await pinnedNow(ctx.root, ctx.cli));
  if (stops.length > 0) {
    attention.push({
      kind: 'version',
      text: `The Plitzi version changed under the run (${[...stops, ...carried].join(', ')}): the agents wait, their work kept in their copies — a person re-pins it in their terminal: plitzi run attach ${record.runId}`,
      who: 'person'
    });
  } else if (carried.length > 0) {
    attention.push({
      kind: 'version',
      text: `A package the SDK brings moved under the run (${carried.join(', ')}): the agents go on, and the finish checks the result on it — a person re-pins it when they like: plitzi run attach ${record.runId}`,
      who: 'person'
    });
  }

  // Free means started and idle: an agent on demand never started is none ("dev-3, design-2 are free" for two
  // agents nobody had started).
  // Advice the lead settled is said no more: what it decided stands for the run.
  const decided = settledFindings(log);
  attention.push(
    ...bottlenecks(
      views,
      started.filter(each => running.has(each.agent)),
      now,
      // What the backlog still holds that no card of the run does: what the lead can stack for an agent with nothing.
      await stackableBacklog(ctx.root, loaded.tasks),
      started
    ).filter(item => !decided.has(item.kind))
  );
  // A run that stands still is said with what holds each task, read as `task next` reads it: the lock on a file it needs.
  const locks = await allLocks(ctx);
  attention.push(...stalled(views, lockHolder(locks, record.runId), running, now));
  attention.push(...heldAhead(views, lockHolder(locks, record.runId)));
  // Agents on demand: told to the lead when work waits for one and none running is free.
  const identified = await identifiedAgents(loaded.paths);
  attention.push(
    ...agentsNeeded(views, started, running, {
      identified,
      scratch: loaded.paths.scratch,
      openFor: now.getTime() - Date.parse(record.openedAt),
      open: record.status === 'open',
      launches: team?.options?.launch !== undefined,
      now: now.getTime()
    })
  );
  // What the run's records show going wrong now, said while the lead can still act (`findings/live.ts`).
  attention.push(
    ...(await liveAttention(
      loaded,
      log,
      now,
      new Set(
        views
          .filter(view => view.state.status === 'done' || view.state.status === 'in-review')
          .map(view => view.task.id)
      )
    ))
  );

  for (const file of await leftInTmp(ctx.root, record)) {
    attention.push({
      kind: 'left-in-tmp',
      file,
      text: `${file} appeared in the project's tmp/ while the run is open — what an agent writes beside its work goes in its copy's tmp/, or between tasks in the run's scratch (${path.relative(ctx.root, loaded.paths.scratch)}/<agent>/), both gone with the run. Tell the agent, and remove it once nobody needs it: the project's tmp/ is the person's, so the run leaves it be`,
      who: 'lead'
    });
  }

  if (record.status === 'stopping') {
    attention.push({
      kind: 'stopping',
      text: `Stopping — ${record.stopReason ?? 'stopped'}: the tasks in hand finish, none starts (plitzi run resume once it is dealt with)`,
      who: 'lead'
    });
  }

  const base = await readBase(loaded.paths);
  const all = await messagesOf(loaded);
  for (const view of views) {
    const line = tasks.find(each => each.id === view.task.id);
    const { proposed } = view.state;
    // What a scout found is the lead's to decide — the tasks with the person — the one way it acts on it.
    if (proposed) {
      attention.push({
        kind: 'spike-proposed',
        task: view.task.id,
        text: `${view.task.id}: ${proposed.by} found it out — ${proposed.text}${proposed.tasks.length > 0 ? ` — and proposes ${proposed.tasks.join(', ')}: decide them with the person (plitzi task next --role lead reads them)` : ''} — plitzi task review ${view.task.id} --approve [--leave <tasks>] | --changes "…"`,
        who: 'lead'
      });
    } else if (view.state.status === 'blocked' && view.state.blockedBy) {
      attention.push({
        kind: view.state.blockedBy.needs === 'person' ? 'person' : 'blocked',
        task: view.task.id,
        text: `${view.task.id} blocked: ${view.state.blockedBy.reason}${asksLead(view.state) ? ` — answer it: plitzi task unblock ${view.task.id} --answer "…" (kept as its finding)` : ''}`,
        who: view.state.blockedBy.needs
      });
    }

    if (view.state.knownFailure && view.state.status !== 'done') {
      attention.push({
        kind: 'known-failure',
        task: view.task.id,
        text: view.state.knownFailure.preexisting
          ? `${view.task.id} went to review with failing checks (${view.state.knownFailure.failing.join(', ')}) that are not its own — ${view.state.knownFailure.why}. The finish needs them green: whoever owns what fails fixes it`
          : `${view.task.id} went to review with failing checks (${view.state.knownFailure.failing.join(', ')}): ${view.state.knownFailure.why}${view.state.knownFailure.fixedBy ? ` — ${view.state.knownFailure.fixedBy} fixes it` : ''}`,
        who: 'lead'
      });
    }

    if (line?.noSignal) {
      attention.push({
        kind: 'no-signal',
        task: view.task.id,
        text: `${view.task.id}: ${String(view.owner?.agent)} has no signal — reassign it (plitzi task reassign ${view.task.id})`,
        who: 'lead'
      });
    }

    const atIt = isWorked(view.state.status) ? view.owner : undefined;
    const long =
      atIt === undefined || line?.spentMinutes === undefined
        ? undefined
        : longTaskAttention(
            {
              id: view.task.id,
              agent: atIt.agent,
              takenAt: atIt.takenAt,
              spentMinutes: line.spentMinutes,
              estimateMinutes: view.task.estimateMinutes,
              ...(view.progress?.step ? { step: view.progress.step } : {})
            },
            all,
            now
          );
    if (long) {
      attention.push(long);
    }

    const waiting = view.state.waitingFor;
    if (waiting) {
      const holder = byId.get(waiting.task);
      const limit = (holder?.task.estimateMinutes ?? 0) * 2;
      if (holder && minutesBetween(waiting.since, now) > limit) {
        attention.push({
          kind: 'long-wait',
          task: view.task.id,
          text: `${view.task.id} has waited ${String(minutesBetween(waiting.since, now))} min for ${waiting.task} ${waitingText(waiting)}`,
          who: 'lead'
        });
      }
    }

    // A file a task makes too long is said to its agent by its own `task check` and refused at `complete` — never the
    // lead's to relay: a run's message arrived after the agent had split it, a stale warning read as current.

    if (view.owner && view.state.status !== 'done') {
      const start = await readStart(view.paths);
      const moved: string[] = [];
      for (const file of view.task.files) {
        const was = start?.overlaid.includes(file) ? (base.files[file] ?? null) : start?.files[file];
        if (was !== undefined && (await fingerprint(under(ctx.root, file))) !== was) {
          moved.push(file);
        }
      }

      if (moved.length > 0) {
        attention.push({
          kind: 'changed-in-project',
          task: view.task.id,
          text:
            view.state.status === 'in-review'
              ? `${moved.join(', ')} changed in the project while ${view.task.id} worked on it: its review decides — plitzi task review ${view.task.id} --approve --merge | --approve --overwrite | --changes "…" (merge when the two go together)`
              : `${moved.join(', ')} changed in the project while ${view.task.id} has it: its work is kept and its review decides (line by line when the two go together) — or it builds on the project's version: plitzi task discard <file>`,
          who: view.state.status === 'in-review' ? 'lead' : 'task'
        });
      }
    }
  }

  (await proposalsOf(loaded))
    .filter(each => each.answer === undefined)
    .forEach(each =>
      attention.push({
        kind: 'proposal',
        task: each.to,
        text: `${each.from} proposes to ${each.to} (${each.id}): ${each.change}${
          byId.get(each.to)?.owner ? '' : ` — nobody holds ${each.to} now: it is answered once it is taken`
        }`,
        who: 'task'
      })
    );

  // A question the lead answered is dealt with, whether or not the lead's inbox was read.
  const answered = new Set(all.flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const asked = all.filter(message => message.to === LEAD && message.fyi !== true);
  (await unreadFor(loaded, LEAD, false))
    .filter(message => !answered.has(message.id))
    // Said for the lead to know of a task approved since — by it, or by a designer about it: its history now, in the
    // inbox — nothing to act on, and it held a run's finish.
    .filter(message => !(message.fyi === true && byId.get(message.about ?? message.from)?.state.status === 'done'))
    .forEach(message =>
      attention.push({
        kind: 'message',
        task: message.from,
        message: message.id,
        ...(message.fyi === true ? { fyi: true as const } : {}),
        ...(message.standing ? { decide: true as const } : {}),
        // A glimpse here; whole in `run watch`, where showing it reads it — and it is gone from here.
        text: message.standing
          ? `${message.from} stands at ${standingText(message.standing)}${message.replyTo ? ` (answering ${message.replyTo})` : ''} — decide: let it go on; tell it what to change (plitzi task message ${message.about === undefined ? message.from : `@${message.from}`} "…"); lift what holds it (plitzi task unblock); narrow it (plitzi run amend) or split it (plitzi run open <stage>); or take it back (plitzi task reassign)`
          : message.fyi
            ? `${message.from} says (${message.id}), for you to know: ${glimpse(message.text)} — read: plitzi task inbox`
            : `${message.from} asks (${message.id}): ${glimpse(message.text)} — answer: plitzi task message ${message.from} "…" --reply-to ${message.id}`,
        who: 'lead'
      })
    );

  // A request of a task not approved yet is no one's to act on: it goes in with the approval (a run's lead was
  // woken for t-match-bars's theme request while it was in review). One left after its approval is.
  const approvedTasks = new Set(views.filter(view => view.state.status === 'done').map(view => view.task.id));
  const pending = (await requestsOf(loaded)).filter(
    each => !each.integrated && each.integratedBy === undefined && approvedTasks.has(each.task)
  );
  // What a request waits for: the task holding its file by turns — merged once that one lets go — or nothing yet.
  pending.forEach(each => {
    const holder = (locks.get(each.request.file) ?? []).find(
      held => held.live && held.run === runId && held.task !== each.task
    );
    attention.push({
      kind: 'request',
      task: each.task,
      text: `Request on ${each.request.file} from ${each.task}: ${each.request.summary}${
        holder ? ` — waits for "${holder.task}", which holds it by turns: merged once it lets go of it` : ''
      }`,
      who: 'lead'
    });
  });

  const approved = await readApproved(loaded.paths);
  Object.entries(approved.files)
    .filter(([, entry]) => entry.overrode !== undefined)
    .forEach(([file, entry]) =>
      attention.push({
        kind: 'overwrite',
        task: entry.task,
        text: `${file} changed in the project while ${entry.task} worked on it: ${entry.task}'s version is written over it at the finish (decided by ${String(entry.overrode?.by)}); the other version is kept`,
        who: 'person'
      })
    );

  const done = views.filter(view => view.state.status === 'done').length;
  const milestones = [...new Set(loaded.tasks.map(task => task.milestone).filter(name => name !== undefined))].map(
    name => {
      const inIt = views.filter(view => view.task.milestone === name);

      return { name, done: inIt.filter(view => view.state.status === 'done').length, total: inIt.length };
    }
  );
  const remaining = loaded.tasks.filter(task => byId.get(task.id)?.state.status !== 'done');
  const chains = chainMinutes(
    remaining.map(task => ({ ...task, dependsOn: task.dependsOn.filter(id => remaining.some(each => each.id === id)) }))
  );
  // Read at the pace this project's runs (or, before one ended, this machine's) took against their estimates: a lead's
  // estimate is the same guess each time — a run's 630 min of plan took 148.
  const pace = await readHistory(ctx.root);
  const left = Math.max(0, ...chains.values()) * (pace?.ratio ?? 1);

  const port = await previewPort(loaded);

  return {
    runId: record.runId,
    goal: loaded.plan.goal,
    status: record.status,
    openedAt: record.openedAt,
    activeOn: record.activeOn,
    done,
    total: views.length,
    milestones,
    ...(remaining.length === 0 ? {} : { expectedEnd: new Date(now.getTime() + left * 60_000).toISOString() }),
    ...(pace ? { pace: { from: pace.from, ratio: pace.ratio } } : {}),
    // A task held on a question to the lead says so where its state is read, not only in the lead's inbox.
    tasks: parked(
      await Promise.all(
        tasks.map(async task => {
          // Only while it is worked: one sent to review is no agent's to wait on, and stood in two of the flow's columns.
          const question = isWorked(task.status) ? asked.filter(message => message.from === task.id).at(-1) : undefined;
          if (!question) {
            return task;
          }

          // Answered, it is held until its agent has the answer — at its next command, which takes it up again.
          const reply = all.find(message => message.replyTo === question.id);
          const unread = reply ? (await unreadFor(loaded, task.id, false)).some(each => each.id === reply.id) : false;
          if (reply && !unread) {
            return task;
          }

          return {
            ...task,
            asking: { id: question.id, text: glimpse(question.text), ...(reply ? { answered: true as const } : {}) }
          };
        })
      ),
      views
    ),
    attention,
    merges: record.merges.map(merge => ({
      id: merge.id,
      kind: merge.kind,
      at: merge.at,
      files: Object.keys(merge.files).length
    })),
    approvedFiles: Object.keys(approved.files).length,
    reviewers: testers,
    gone: [...gone],
    ...(port === undefined ? {} : { previewPort: port }),
    identified,
    scratch: loaded.paths.scratch,
    ...(log.some(entry => entry.action === 'open' && entry.scoped === 'before') ? { scopedBefore: true as const } : {})
  };
};

/** A run of the project as `plitzi run status --all` lists it: where it stands, and what writes it into the project. */
export interface ProjectRun {
  runId: string;
  goal: string;
  status: string;
  done: number;
  total: number;
  /** The machine it is active on — none once released. */
  activeOn?: string;
  /** What needs someone now. */
  attention: number;
  /** Every task done and nothing in the way: the finish is all that is left. */
  ready: boolean;
  /** A person let the lead write it into the project itself. */
  leadFinishes: boolean;
  /** What writes it into the project — the person's to run, unless the lead may. */
  apply: string;
}

/**
 * `plitzi run status --all`: every run of this project not yet written into it — the ones ready to apply first, each with the
 * command that applies it, so nobody keeps the list in their head.
 */
export const runsState = async (ctx: RunContext): Promise<ProjectRun[]> => {
  const runs: ProjectRun[] = [];
  for (const runId of await runIds(ctx.root)) {
    const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true }).catch(() => undefined);
    const view = loaded ? await viewRun(ctx, runId).catch(() => undefined) : undefined;
    if (!loaded || !view) {
      continue;
    }

    runs.push({
      runId,
      goal: view.goal,
      status: view.status,
      done: view.done,
      total: view.total,
      ...(view.activeOn.machine ? { activeOn: view.activeOn.machine } : {}),
      attention: view.attention.length,
      ready: view.done === view.total && (view.status === 'open' || view.status === 'stopped'),
      leadFinishes: loaded.record.leadFinishes !== undefined,
      apply: projectExec(`plitzi run finish ${runId} --apply`)
    });
  }

  return runs.sort((a, b) => Number(b.ready) - Number(a.ready) || a.runId.localeCompare(b.runId));
};
