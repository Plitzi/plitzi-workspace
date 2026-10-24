import path from 'node:path';

import { proposalsOf } from './agreements';
import { answering } from './answering';
import { stackableBacklog } from './backlog';
import { bottlenecks } from './bottlenecks';
import { designSkipText } from './designSkip';
import { fingerprint } from './files';
import { liveAttention } from './findings/live';
import { readHistory } from './history';
import { identifiedAgents } from './identity';
import { askingLeads, reviewersOf, UNTAKEN_REVIEW_MS } from './leads';
import { LEAD, messagesOf, unreadFor } from './messages';
import { agentsNeeded } from './onDemand';
import { under } from './paths';
import { previewPort } from './previewRecord';
import { loadRun, pinnedChanges, pinnedNow, readApproved, readBase, readRunLog, runIds, samePinned } from './run';
import { agentsNow } from './running';
import { leftInTmp } from './strays';
import { allLocks, requestsOf } from './tasks';
import { isDisconnected, readStart, viewTask } from './taskStore';
import { readTeam, startedAgents } from './team';
import { chainMinutes, urgencies } from './urgency';
import { isWorked } from './worked';

import type { DesignReview, Needs, Priority, RunRecord, TaskStatus, Waiting } from './model';
import type { RunContext } from './run';
import type { TaskView } from './taskStore';

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
  /** Its UI's review by a designer, in a run that has one. */
  design?: DesignReview;
  /** In review: the lead that took this round's review, once one did. */
  reviewer?: string;
  /** When its holder was last heard from — a command, a heartbeat, a write in its copy. */
  signalAt?: string;
  /** In review: since when it is as it is — sent, or its UI said — what a review no lead takes has waited from. */
  since?: string;
  /** In spike: what it is finding out. */
  spike?: string;
  /** How many findings its spikes left: a task the run researched. */
  found?: number;
  /** In spike: the lead finding it out, once one took it. */
  spikedBy?: string;
  /**
   * At work, while its agent is at another of the tasks it holds — one at a time: that one. A task sent back while its
   * agent wrote the next one was on the board twice, its agent "ready" and "at work" at once (velada-dress).
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
    | 'ui-waits'
    | 'ui-queued'
    | 'held-up'
    | 'slow-review'
    | 'idle-team'
    | 'agents-needed'
    | 'refused-again'
    | 'finding'
    | 'spikes'
    | 'message';
  task?: string;
  /** The file it is about, when it is about one: what keeps it the same notice while its words change. */
  file?: string;
  /**
   * What else keeps it the same notice while its words change — idle agents and how far the board is: lx-product's lead
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
  /** The leads besides `lead` that review (`lead-2`…): who may take the reviews, when the run has some. */
  leads: string[];
  /** Who takes reviews beside `lead`: the leads that review, and the team's testers. */
  reviewers: string[];
  /** Those of them running now — each asked for a review within the last minute. */
  askingLeads: string[];
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
const waitingText = (waiting: Waiting): string =>
  waiting.proposal ? `to answer ${waiting.proposal}` : `on ${waiting.file ?? 'a file'}`;

const minutesBetween = (from: string, to: Date): number => Math.round((to.getTime() - Date.parse(from)) / 60_000);

/** Past its work: in review or approved, what its agent last said of the work is history. */
const past = (view: TaskView): boolean => view.state.status === 'in-review' || view.state.status === 'done';

const lineOf = (view: TaskView, now: Date, owesSignal: boolean, unblocks: string[], urgency: Priority): TaskLine => ({
  id: view.task.id,
  title: view.task.title,
  kind: view.task.kind,
  role: view.task.role ?? 'developer',
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
  estimateMinutes: view.task.estimateMinutes,
  ...(view.owner ? { spentMinutes: minutesBetween(view.owner.takenAt, now) } : {}),
  noSignal: owesSignal && isWorked(view.state.status) && isDisconnected(view.task, view.signalAt, now),
  ...(view.owner ? { takenAt: view.owner.takenAt } : {}),
  ...(view.state.design ? { design: view.state.design } : {}),
  ...(view.state.status === 'in-review' && view.state.reviewer?.round === view.state.round
    ? { reviewer: view.state.reviewer.by }
    : {}),
  ...(view.state.status === 'in-review' ? { since: view.state.updatedAt } : {}),
  ...(view.owner && view.signalAt !== undefined ? { signalAt: new Date(view.signalAt).toISOString() } : {}),
  unblocks,
  ...(view.task.milestone ? { milestone: view.task.milestone } : {}),
  ...(view.state.status === 'spike' ? { spike: view.task.spike ?? 'what it needs' } : {}),
  ...(view.state.findings && view.state.findings.length > 0 ? { found: view.state.findings.length } : {}),
  ...(view.state.status === 'spike' && view.state.spikedBy ? { spikedBy: view.state.spikedBy.by } : {})
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
  const log = await readRunLog(loaded.paths);
  const { gone, starting, running } = await agentsNow(loaded.paths, views, team, log, now);
  // A task sent back to an agent not running waits for it to be started, and the lead is told that (`agentsNeeded`):
  // "no signal — reassign it" beside it contradicted it (encore-2: t-room-read's dev-2).
  const owesSignal = (view: TaskView): boolean =>
    view.owner !== undefined &&
    !starting.has(view.owner.agent) &&
    !(view.state.status === 'changes-requested' && !running.has(view.owner.agent));
  const tasks = views.map(view => {
    const line = lineOf(
      view,
      now,
      owesSignal(view),
      loaded.tasks.filter(task => task.dependsOn.includes(view.task.id)).map(task => task.id),
      urgency.get(view.task.id) ?? view.task.priority
    );
    const waitsOn = view.task.dependsOn.filter(id => !approvedIds.has(id));

    return view.state.status === 'pending' && waitsOn.length > 0 ? { ...line, waitsOn } : line;
  });
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
  const pinned = await pinnedNow(ctx.root, ctx.cli);
  if (!samePinned(record.pinned, pinned)) {
    attention.push({
      kind: 'version',
      text: `The Plitzi version changed under the run (${pinnedChanges(record.pinned, pinned).join(', ')}): the agents wait, their work kept in their copies — a person re-pins it in their terminal: plitzi run attach ${record.runId}`,
      who: 'person'
    });
  }

  // Free means started and idle: an agent on demand never started is none (lx-copy: "dev-3, design-2 are free" for two
  // agents nobody had started).
  attention.push(
    ...bottlenecks(
      views,
      started.filter(each => running.has(each.agent)),
      now,
      // What the backlog still holds that no card of the run does: what the lead can stack for an agent with nothing.
      await stackableBacklog(ctx.root, loaded.tasks)
    )
  );
  // Agents on demand: told to the lead when work waits for one and none running is free.
  const identified = await identifiedAgents(loaded.paths);
  attention.push(
    ...agentsNeeded(views, started, running, {
      identified,
      scratch: loaded.paths.scratch,
      openFor: now.getTime() - Date.parse(record.openedAt),
      open: record.status === 'open'
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
  for (const view of views) {
    const line = tasks.find(each => each.id === view.task.id);
    if (view.state.status === 'blocked' && view.state.blockedBy) {
      attention.push({
        kind: view.state.blockedBy.needs === 'person' ? 'person' : 'blocked',
        task: view.task.id,
        text: `${view.task.id} blocked: ${view.state.blockedBy.reason}`,
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

    if (line?.spentMinutes !== undefined && line.spentMinutes > view.task.estimateMinutes * 2) {
      attention.push({
        kind: 'long-task',
        task: view.task.id,
        text: `${view.task.id} has taken ${String(line.spentMinutes)} min of an estimated ${String(view.task.estimateMinutes)}`,
        who: 'lead'
      });
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
    // lead's to relay: lx-controls' message arrived after the agent had split it, a stale warning read as current.

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
              ? `${moved.join(', ')} changed in the project while ${view.task.id} worked on it: its review decides — --approve --merge when the two go together, --approve --overwrite, or --changes`
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
  const answered = new Set((await messagesOf(loaded)).flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const all = await messagesOf(loaded);
  const asked = all.filter(message => message.to === LEAD && message.fyi !== true);
  // A question a lead that reviews took is its to answer: the lead is told of it only once it waited unanswered.
  const taken = await answering(loaded);
  const answeringNow = (message: { id: string; fyi?: boolean }): boolean =>
    message.fyi !== true &&
    Object.hasOwn(taken, message.id) &&
    now.getTime() - Date.parse(taken[message.id].at) < UNTAKEN_REVIEW_MS;
  (await unreadFor(loaded, LEAD, false))
    .filter(message => !answered.has(message.id) && !answeringNow(message))
    // Said for the lead to know of a task approved since — by it, or by a designer about it: its history now, in the
    // inbox — nothing to act on, and it held velada-now's finish.
    .filter(message => !(message.fyi === true && byId.get(message.about ?? message.from)?.state.status === 'done'))
    .forEach(message =>
      attention.push({
        kind: 'message',
        task: message.from,
        message: message.id,
        ...(message.fyi === true ? { fyi: true as const } : {}),
        // A glimpse here; whole in `run watch`, where showing it reads it — and it is gone from here.
        text: message.fyi
          ? `${message.from} says (${message.id}), for you to know: ${glimpse(message.text)} — read: plitzi task inbox`
          : `${message.from} asks (${message.id}): ${glimpse(message.text)}${Object.hasOwn(taken, message.id) ? ` — ${taken[message.id].by} took it and has not answered` : ''} — answer: plitzi task message ${message.from} "…" --reply-to ${message.id}`,
        who: 'lead'
      })
    );

  // A request of a task not approved yet is no one's to act on: it goes in with the approval (velada-polish's lead was
  // woken for t-match-bars's theme request while it was in review). One left after its approval is.
  const approvedTasks = new Set(views.filter(view => view.state.status === 'done').map(view => view.task.id));
  const pending = (await requestsOf(loaded)).filter(
    each => !each.integrated && each.integratedBy === undefined && approvedTasks.has(each.task)
  );
  // What a request waits for: the task holding its file by turns — merged once that one lets go — or nothing yet.
  const locks = await allLocks(ctx);
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
  // estimate is the same guess each time — encore's 630 min of plan took 148.
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
    leads: record.leads ?? [],
    reviewers: await reviewersOf(loaded),
    askingLeads: await askingLeads(loaded, now),
    gone: [...gone],
    ...(port === undefined ? {} : { previewPort: port }),
    identified,
    scratch: loaded.paths.scratch,
    ...(log.some(entry => entry.action === 'open' && entry.scoped === 'before') ? { scopedBefore: true as const } : {})
  };
};

const ICON: Record<TaskStatus, string> = {
  pending: '·',
  spike: '◇',
  ready: '○',
  'in-progress': '▶',
  waiting: '…',
  'in-review': '◎',
  'changes-requested': '↺',
  done: '✓',
  blocked: '■',
  failed: '✗'
};

const hhmm = (iso: string): string => `${iso.slice(11, 16)} UTC`;

/** Where a task's UI review is, in a line. */
const designText = (design: DesignReview): string =>
  design.status === 'due'
    ? `its UI with ${design.by ?? 'a designer, not taken yet'}`
    : design.status === 'approved'
      ? `UI approved by ${design.by ?? 'a designer'}`
      : designSkipText(design.why);

/** A run as `plitzi run watch` prints it: the run, a line per task, then what needs attention. */
export const runText = (view: RunView): string => {
  const head = `${view.goal} · ${view.status} · ${String(view.done)} of ${String(view.total)} tasks${view.expectedEnd ? ` · expected end ${hhmm(view.expectedEnd)}${view.pace ? ` (at this ${view.pace.from}'s pace, ${String(Math.round(view.pace.ratio * 100))}% of the estimates)` : ''}` : ''}`;
  const lines = [head];
  view.milestones.forEach(milestone =>
    lines.push(`  ${milestone.name}: ${String(milestone.done)} of ${String(milestone.total)}`)
  );
  for (const task of view.tasks) {
    const progress = task.fraction === undefined ? '' : ` · ${String(Math.round(task.fraction * 100))} %`;
    const step = task.step ? ` · ${task.step}` : '';
    const agent = task.agent ? `${task.agent}: ` : '';
    const extra =
      task.status === 'waiting' && task.waitingFor
        ? ` · waits for ${task.waitingFor.task} ${waitingText(task.waitingFor)}`
        : task.waitsOn
          ? ` · after ${task.waitsOn.join(', ')}`
          : task.status === 'blocked' && task.blockedBy
            ? ` · ${task.blockedBy.reason}`
            : task.status === 'changes-requested'
              ? ` · changes requested (round ${String(task.round)})`
              : task.status === 'in-review' && task.design?.status === 'due'
                ? ` · ${designText(task.design)}`
                : task.status === 'in-review'
                  ? `${task.design ? ` · ${designText(task.design)}` : ''}${task.reviewer ? ` · ${task.reviewer} reviews it` : view.leads.length > 0 ? ' · no lead took it yet' : ''}`
                  : '';
    lines.push(
      `  ${ICON[task.status]} ${task.id.padEnd(18)} ${task.role === 'developer' ? '' : `[${task.role}] `}${agent}${task.title}${step}${progress}${extra}${task.noSignal ? ' · no signal' : ''}`
    );
  }

  if (view.attention.length > 0) {
    lines.push('Needs attention');
    view.attention.forEach(item => lines.push(`  ${item.who === 'person' ? '■' : '⚠'} ${item.text}`));
  }

  if (view.status === 'open' || view.status === 'stopping') {
    lines.push(
      view.previewPort === undefined
        ? 'In a browser, as the tasks are approved: npm run start:preview (plitzi run preview) — the project itself is untouched until the finish'
        : `In a browser, as the tasks are approved: http://127.0.0.1:${String(view.previewPort)} (the run's preview)`
    );
  }

  if (view.merges.length > 0) {
    lines.push(
      `Written into the project: ${view.merges.map(merge => `${merge.id} ${merge.kind} (${String(merge.files)} files)`).join(', ')}`
    );
  }

  return lines.join('\n');
};

/** `plitzi run state`: every run of the project, with where it stands. */
export interface PendingRun {
  runId: string;
  goal: string;
  status: string;
  done: number;
  total: number;
  /** Every task done and nothing in the way: the finish is all that is left. */
  ready: boolean;
  /** A person let the lead write it into the project itself. */
  leadFinishes: boolean;
  /** What writes it into the project — the person's to run, unless the lead may. */
  apply: string;
}

/**
 * `plitzi run pending`: the runs of this project not yet written into it — the ones ready to apply first, each with the
 * command that applies it, so nobody keeps the list in their head.
 */
export const pendingRuns = async (ctx: RunContext): Promise<PendingRun[]> => {
  const pending: PendingRun[] = [];
  for (const runId of await runIds(ctx.root)) {
    const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true }).catch(() => undefined);
    const view = loaded ? await viewRun(ctx, runId).catch(() => undefined) : undefined;
    if (!loaded || !view) {
      continue;
    }

    pending.push({
      runId,
      goal: view.goal,
      status: view.status,
      done: view.done,
      total: view.total,
      ready: view.done === view.total && (view.status === 'open' || view.status === 'stopped'),
      leadFinishes: loaded.record.leadFinishes !== undefined,
      apply: `npx plitzi run finish ${runId} --apply`
    });
  }

  return pending.sort((a, b) => Number(b.ready) - Number(a.ready) || a.runId.localeCompare(b.runId));
};

export const runsState = async (
  ctx: RunContext
): Promise<{ runId: string; status: string; done: number; total: number; activeOn: string; attention: number }[]> => {
  const all = [];
  for (const runId of await runIds(ctx.root)) {
    const view = await viewRun(ctx, runId).catch(() => undefined);
    if (view) {
      all.push({
        runId,
        status: view.status,
        done: view.done,
        total: view.total,
        activeOn: view.activeOn.machine,
        attention: view.attention.length
      });
    }
  }

  return all;
};
