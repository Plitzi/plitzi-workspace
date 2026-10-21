import path from 'node:path';

import { proposalsOf } from './agreements';
import { fingerprint } from './files';
import { askingLeads } from './leads';
import { longFileText, longFilesIn } from './longFiles';
import { LEAD, messagesOf, unreadFor } from './messages';
import { designSkipText } from './model';
import { under } from './paths';
import { chainMinutes } from './plan';
import { previewPort } from './previewRecord';
import { loadRun, pinnedChanges, pinnedNow, readApproved, readBase, runIds, samePinned } from './run';
import { leftInTmp } from './strays';
import { allLocks, requestsOf } from './tasks';
import { isDisconnected, readStart, viewTask } from './taskStore';
import { DESIGNER, readTeam, startedAgents } from './team';

import type { DesignReview, Needs, RunRecord, TaskStatus, Waiting } from './model';
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
  /** At work, held on a question its agent asked the lead and nobody answered: which, in a line. */
  asking?: { id: string; text: string };
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
    | 'file-too-long'
    | 'version'
    | 'left-in-tmp'
    | 'ui-waits'
    | 'message';
  task?: string;
  /** The file it is about, when it is about one: what keeps it the same notice while its words change. */
  file?: string;
  text: string;
  /** Who acts on it. */
  who: Needs;
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
  tasks: TaskLine[];
  attention: Attention[];
  merges: { id: string; kind: string; at: string; files: number }[];
  approvedFiles: number;
  /** The leads besides `lead` that review (`lead-2`…): who may take the reviews, when the run has some. */
  leads: string[];
  /** Those of them running now — each asked for a review within the last minute. */
  askingLeads: string[];
  /** Where the run's approved work is served while a preview serves it (`run preview`, `npm run start:preview`). */
  previewPort?: number;
}

/** What a wait is on: a file, or an answer to a proposal. */
const waitingText = (waiting: Waiting): string =>
  waiting.proposal ? `to answer ${waiting.proposal}` : `on ${waiting.file ?? 'a file'}`;

const minutesBetween = (from: string, to: Date): number => Math.round((to.getTime() - Date.parse(from)) / 60_000);

const lineOf = (view: TaskView, now: Date, unblocks: string[]): TaskLine => ({
  id: view.task.id,
  title: view.task.title,
  kind: view.task.kind,
  role: view.task.role ?? 'developer',
  status: view.state.status,
  priority: view.task.priority,
  ...(view.owner ? { agent: view.owner.agent } : {}),
  ...(view.progress?.step ? { step: view.progress.step } : {}),
  ...(view.progress?.fraction !== undefined ? { fraction: view.progress.fraction } : {}),
  round: view.state.round,
  files: view.task.files,
  updatedAt: view.state.updatedAt,
  ...(view.state.waitingFor ? { waitingFor: view.state.waitingFor } : {}),
  ...(view.state.blockedBy ? { blockedBy: view.state.blockedBy } : {}),
  estimateMinutes: view.task.estimateMinutes,
  ...(view.owner ? { spentMinutes: minutesBetween(view.owner.takenAt, now) } : {}),
  noSignal:
    view.owner !== undefined &&
    (view.state.status === 'in-progress' || view.state.status === 'changes-requested') &&
    isDisconnected(view.task, view.signalAt, now),
  ...(view.owner ? { takenAt: view.owner.takenAt } : {}),
  ...(view.state.design ? { design: view.state.design } : {}),
  ...(view.state.status === 'in-review' && view.state.reviewer?.round === view.state.round
    ? { reviewer: view.state.reviewer.by }
    : {}),
  ...(view.state.status === 'in-review' ? { since: view.state.updatedAt } : {}),
  ...(view.owner && view.signalAt !== undefined ? { signalAt: new Date(view.signalAt).toISOString() } : {}),
  unblocks,
  ...(view.task.milestone ? { milestone: view.task.milestone } : {})
});

export const viewRun = async (ctx: RunContext, runId: string): Promise<RunView> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const now = ctx.now();
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const byId = new Map(views.map(view => [view.task.id, view]));
  const approvedIds = new Set(views.filter(view => view.state.status === 'done').map(view => view.task.id));
  const tasks = views.map(view => {
    const line = lineOf(
      view,
      now,
      loaded.tasks.filter(task => task.dependsOn.includes(view.task.id)).map(task => task.id)
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

  // UI reviews nobody takes: every designer is at a task of its own — the lead's, or they wait for nobody.
  const team = await readTeam(ctx.root).catch(() => undefined);
  const designers = (team ? startedAgents(team) : [])
    .filter(each => each.roles.includes(DESIGNER))
    .map(each => each.agent);
  const atOwn = (agent: string): string | undefined =>
    views.find(
      view =>
        view.owner?.agent === agent &&
        (view.state.status === 'in-progress' || view.state.status === 'changes-requested')
    )?.task.id;
  const uiWaiting = views.filter(
    view =>
      view.state.status === 'in-review' && view.state.design?.status === 'due' && view.state.design.by === undefined
  );
  if (uiWaiting.length > 0 && designers.length > 0 && designers.every(agent => atOwn(agent) !== undefined)) {
    attention.push({
      kind: 'ui-waits',
      text: `${uiWaiting.map(view => view.task.id).join(', ')} wait for a UI review, and no designer is free (${designers.map(agent => `${agent} at ${String(atOwn(agent))}`).join(', ')}): start another designer (team.json's designers) — or review them yourself, UI included (both schemes, the phone width): plitzi task next --role lead --take, then --approve --skip-design lead`,
      who: 'lead'
    });
  }

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

    // A file a task is making too long to read whole: the lead asks for the split while it is still cheap.
    if (view.owner && (view.state.status === 'in-progress' || view.state.status === 'changes-requested')) {
      for (const long of await longFilesIn(view.paths.work, ctx.root)) {
        attention.push({
          kind: 'file-too-long',
          task: view.task.id,
          file: long.file,
          text: `${view.task.id}: ${longFileText(long)} — ask it to split it now, by what changes together (plitzi task message ${view.task.id} "…")`,
          who: 'lead'
        });
      }
    }

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
  const questions = (await messagesOf(loaded)).filter(
    message => message.to === LEAD && message.fyi !== true && !answered.has(message.id)
  );
  (await unreadFor(loaded, LEAD, false))
    .filter(message => !answered.has(message.id))
    // Said for the lead to know by a task approved since: its history now, in the inbox — nothing to act on.
    .filter(message => !(message.fyi === true && byId.get(message.from)?.state.status === 'done'))
    .forEach(message =>
      attention.push({
        kind: 'message',
        task: message.from,
        text: message.fyi
          ? `${message.from} says (${message.id}), for you to know: ${glimpse(message.text)} — read: plitzi task inbox`
          : `${message.from} asks (${message.id}): ${glimpse(message.text)} — answer: plitzi task message ${message.from} "…" --reply-to ${message.id}`,
        who: 'lead'
      })
    );

  const pending = (await requestsOf(loaded)).filter(each => !each.integrated && each.integratedBy === undefined);
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
  const left = Math.max(0, ...chains.values());

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
    // A task held on a question to the lead says so where its state is read, not only in the lead's inbox.
    tasks: tasks.map(task => {
      const question = questions.filter(message => message.from === task.id).at(-1);

      return question && task.status !== 'done'
        ? { ...task, asking: { id: question.id, text: glimpse(question.text) } }
        : task;
    }),
    attention,
    merges: record.merges.map(merge => ({
      id: merge.id,
      kind: merge.kind,
      at: merge.at,
      files: Object.keys(merge.files).length
    })),
    approvedFiles: Object.keys(approved.files).length,
    leads: record.leads ?? [],
    askingLeads: await askingLeads(loaded, now),
    ...(port === undefined ? {} : { previewPort: port })
  };
};

const ICON: Record<TaskStatus, string> = {
  pending: '·',
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
  const head = `${view.goal} · ${view.status} · ${String(view.done)} of ${String(view.total)} tasks${view.expectedEnd ? ` · expected end ${hhmm(view.expectedEnd)}` : ''}`;
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
