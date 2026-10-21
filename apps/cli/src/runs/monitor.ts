import { isRecord } from '@plitzi/sdk-shared/helpers';

import { designSkipText, isDesignSkip } from './designSkip';
import { LEAD, messagesOf } from './messages';
import { runPaths } from './paths';
import { presentAt, PRESENCE_STALE_MS } from './presence';
import { loadRun, readRunLog, runIds } from './run';
import { choiceText, readTeam, startedAgents } from './team';
import { viewRun } from './view';
import { isWorked } from './worked';

import type { DesignSkip } from './designSkip';
import type { RunContext } from './run';
import type { RunView, TaskLine } from './view';

/**
 * What `plitzi run monitor` shows, gathered by reading only: the run, every agent and what it does, and what happened
 * last — takes, completions, reviews and their verdicts, messages — newest first. Nothing is marked read.
 */

/** How soon after its completion a note to the lead is the completion's own (`complete --note` sends it right after). */
const NOTE_WITHIN_MS = 5000;

/** Where an agent stands, at a glance. */
export type AgentStatus =
  | 'working'
  | 'reviewing'
  | 'blocked'
  | 'asking'
  | 'waiting'
  | 'idle'
  | 'stopped'
  | 'done'
  | 'not-started'
  | 'no-signal';

export interface AgentLine {
  agent: string;
  kind: 'lead' | 'co-lead' | 'agent';
  status: AgentStatus;
  /** The model it is started with, as the team names it — the harness's own when the team says none. */
  model?: string;
  roles: string[];
  /** What it does now, in a line: the task it writes, the review it gives — or that it waits. */
  doing: string;
  /** The task it is at, when one. */
  task?: string;
  /** When it was last heard from, when the CLI knows. */
  signalAt?: string;
  noSignal?: boolean;
  /** The tasks it wrote that are approved. */
  approved: number;
}

export interface FeedLine {
  at: string;
  by: string;
  /** What happened, said — whole, for a surface that shows one line of text. */
  text: string;
  kind:
    | 'take'
    | 'complete'
    | 'review'
    | 'approved'
    | 'sent-back'
    | 'message'
    | 'question'
    | 'agent'
    | 'run'
    | 'problem'
    | 'other';
  /** A message's: who it is to — `lead`, a task, an agent, or every task. */
  to?: string;
  /** A message's words, apart from who said them to whom. */
  quote?: string;
  /** The task it is about, when one. */
  task?: string;
  /** What makes two lines the same event again: a refusal of one command, a failed check of one task. */
  group?: string;
  /** Repeated: how many times in a row, the newest said, since the oldest. */
  count?: number;
  since?: string;
  /** Repeated: each of them, newest first — what a person opens the line to read. */
  repeats?: FeedLine[];
}

/**
 * The activity with each event repeated in a row said once — "×6 since 09:12" — the newest's words kept: six refused
 * finishes of one CDN's afternoon were six lines saying the same.
 */
export const groupRepeats = (lines: readonly FeedLine[]): FeedLine[] => {
  const grouped: FeedLine[] = [];
  for (const line of lines) {
    const before = grouped.at(-1);
    const key = (each: FeedLine) => `${each.by}|${each.kind}|${each.group ?? each.text}`;
    if (before && key(before) === key(line)) {
      before.repeats = [...(before.repeats ?? [{ ...before }]), line];
      before.count = before.repeats.length;
      before.since = line.at;
    } else {
      grouped.push({ ...line });
    }
  }

  return grouped;
};

/**
 * What the log says of a task — who wrote it, who said its UI, who approved it and when: what a task approved no longer
 * holds (its owner goes with the approval), and what a person asks of a row of the panel.
 */
export interface TaskStory {
  /** Each agent that took it, in the order they did. */
  writers: string[];
  /** Its first take: the start of its work. */
  takenAt?: string;
  /** The designer that approved its UI, or `skipped` when the lead went first — and why it did. */
  design?: string;
  designSkip?: DesignSkip;
  approvedBy?: string;
  approvedAt?: string;
  /** Rounds sent back: by a lead or a designer. */
  sentBack: number;
  /** Checks that failed in its copy, at `check` and `complete`. */
  failedChecks: number;
}

export interface Monitored {
  view: RunView;
  agents: AgentLine[];
  feed: FeedLine[];
  /** Each task's story, by its id. */
  stories: Partial<Record<string, TaskStory>>;
  /** Every run of the project, this one among them: which is shown, and that there are others. */
  runs: { runId: string; status: string }[];
  /**
   * The stage the run is at, when stages were stacked on it (`run extend`): its name, its goal — a stage stacked before
   * the log kept it has none, and the run's whole goal is said — and how many stages the run has, its first included.
   */
  stage?: { name: string; goal?: string; of: number };
}

/** Each task's story, read off the run's log once. */
export const storiesOf = (log: readonly Record<string, unknown>[]): Partial<Record<string, TaskStory>> => {
  const stories: Partial<Record<string, TaskStory>> = {};
  for (const entry of log) {
    if (typeof entry.task !== 'string' || typeof entry.at !== 'string') {
      continue;
    }

    const story = (stories[entry.task] ??= { writers: [], sentBack: 0, failedChecks: 0 });
    const by = typeof entry.by === 'string' ? entry.by : undefined;
    if (entry.action === 'take' && by !== undefined) {
      story.takenAt ??= entry.at;
      if (story.writers.at(-1) !== by) {
        story.writers.push(by);
      }
    } else if (entry.action === 'design-review' && entry.verdict === 'approve' && by !== undefined) {
      story.design = by;
    } else if (entry.action === 'review' && entry.verdict === 'approve') {
      story.approvedAt = entry.at;
      story.approvedBy = by ?? LEAD;
      if (entry.design === 'skipped') {
        story.design ??= 'skipped';
        if (isDesignSkip(entry.designSkip)) {
          story.designSkip = entry.designSkip;
        }
      }
    } else if (entry.action === 'review' || (entry.action === 'design-review' && entry.verdict !== 'approve')) {
      story.sentBack += 1;
    } else if (entry.action === 'check' && entry.ok === false) {
      story.failedChecks += 1;
    }
  }

  return stories;
};

const statusOf = (task: TaskLine): AgentStatus =>
  task.asking
    ? 'asking'
    : task.noSignal
      ? 'no-signal'
      : // Held at review only by the designer at its UI review (`assignee`): what it is at.
        task.status === 'in-review'
        ? 'reviewing'
        : task.status === 'blocked' || task.status === 'waiting'
          ? 'blocked'
          : 'working';

const doingOf = (task: TaskLine): string => {
  if (task.asking) {
    return `${task.id} waits for the lead's answer to ${task.asking.id}: ${task.asking.text}`;
  }

  switch (task.status) {
    case 'in-review':
      return `reviews the UI of ${task.id}`;
    case 'changes-requested':
      return `redoes ${task.id} (round ${String(task.round)})`;
    case 'waiting':
      return `${task.id} waits for ${task.waitingFor?.task ?? 'another task'}`;
    case 'blocked':
      return `${task.id} blocked`;
    default:
      return `writes ${task.id}${task.step ? ` — ${task.step}` : ''}`;
  }
};

/**
 * What an agent last did, in its row's words: the feed's line — or, for a message, that it wrote one, which the feed says
 * by its own words. Nothing for what says nothing of the agent (the brake's count).
 */
const lastDone = (entry: Record<string, unknown>): string | undefined => {
  switch (entry.action) {
    case 'ask':
      return `asked the lead on ${textOf(entry.task)}`;
    case 'tell':
      return `told the lead on ${textOf(entry.task)}`;
    case 'message':
      return `wrote to ${textOf(entry.to) || 'the run'}`;
    default:
      return feedOf(entry)?.text;
  }
};

/** How recent a lead that reviews must have done something to count as started: idle, not waiting to be started. */
const ACTIVE_MS = 3 * 60_000;

/** Every agent: the team's, the leads — what each is at, from the tasks they hold and the reviews they took. */
const agentsOf = async (
  ctx: RunContext,
  view: RunView,
  log: readonly Record<string, unknown>[],
  stories: Partial<Record<string, TaskStory>>
): Promise<AgentLine[]> => {
  const approvedBy = new Map<string, number>();
  for (const story of Object.values(stories)) {
    const writer = story?.writers.at(-1);
    if (story?.approvedAt !== undefined && writer !== undefined) {
      approvedBy.set(writer, (approvedBy.get(writer) ?? 0) + 1);
    }
  }

  const lastBy = new Map<string, Record<string, unknown>>();
  for (const entry of log) {
    if (typeof entry.by === 'string' && lastDone(entry) !== undefined) {
      lastBy.set(entry.by, entry);
    }
  }

  const now = ctx.now().getTime();
  const team = await readTeam(ctx.root).catch(() => undefined);
  // A task is whoever is at it: its writer while it is written or sent back, its designer while it waits on that one's
  // UI review — and, at the lead's review, the lead's (its row says so). Its writer is free once it went to review.
  const assignee = (task: TaskLine): string | undefined =>
    task.status === 'in-review' ? (task.design?.status === 'due' ? task.design.by : undefined) : task.agent;
  const held = new Map<string, TaskLine>();
  const holds = new Map<string, TaskLine[]>();
  for (const task of view.tasks) {
    const holder = assignee(task);
    if (holder && task.status !== 'done') {
      holds.set(holder, [...(holds.get(holder) ?? []), task]);
      // The one it is at, of its tasks at work: the others wait for it (`parkedFor`) — its row says the one the flow does.
      const was = held.get(holder);
      if (!was || (was.parkedFor !== undefined && task.parkedFor === undefined)) {
        held.set(holder, task);
      }
    }
  }

  // What waits on a designer: a UI review no designer took — said on each designer, which may be at a task of its own.
  // Waiting, in a few words — how the run stands, not the list of every task (the activity says that): its line is one
  // row of the panel, and a designer waiting for its first review showed the whole of the waiting's reason there.
  const atWork = view.tasks.filter(task => isWorked(task.status)).length;
  const pending = view.tasks.filter(task => task.status === 'pending').length;
  const standing = [`${String(atWork)} at work`, ...(pending > 0 ? [`${String(pending)} pending`] : [])].join(', ');
  const tookAny = new Set(
    log.flatMap(entry => (entry.action === 'take' && typeof entry.by === 'string' ? [entry.by] : []))
  );
  const betweenTasks = (agent: string, last: Record<string, unknown> | undefined): string =>
    last?.action === 'waiting'
      ? `${tookAny.has(agent) ? 'waiting for work' : 'waiting for its first task'} — ${standing}`
      : `between tasks${last ? ` — last: ${lastDone(last) ?? ''}` : ' — not started yet'}`;
  const uiWaiting = view.tasks.filter(
    task => task.status === 'in-review' && task.design?.status === 'due' && task.design.by === undefined
  );

  const reviewing = new Map(view.tasks.flatMap(task => (task.reviewer ? [[task.reviewer, task.id] as const] : [])));
  const leadModel = team?.lead?.model === undefined ? undefined : choiceText(team.lead.model);
  // Every task approved: the leads' part is over, whatever they did last — the board says what is next, and whose.
  const finished = view.total > 0 && view.done === view.total;
  const readyAt = log.findLast(entry => entry.action === 'ready')?.at;
  const changedSince = log.some(
    entry =>
      typeof readyAt === 'string' &&
      typeof entry.at === 'string' &&
      entry.at > readyAt &&
      ['take', 'complete', 'review', 'extend', 'amend', 'revert'].includes(String(entry.action))
  );
  const nextStep =
    typeof readyAt === 'string' && !changedSince
      ? 'the run is ready — the person applies it: plitzi run finish --apply'
      : 'every task approved — next: plitzi run finish, whose dry run checks the whole result';
  const leads: AgentLine[] = [LEAD, ...view.leads].map(lead => {
    if (finished) {
      return {
        agent: lead,
        kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
        approved: 0,
        status: lead === LEAD ? ('done' as const) : ('stopped' as const),
        ...(leadModel ? { model: leadModel } : {}),
        roles: [lead === LEAD ? 'plans, reviews, finishes' : 'reviews'],
        doing: lead === LEAD ? nextStep : 'nothing is left to review'
      };
    }

    const at = reviewing.get(lead);
    const asking = view.askingLeads.includes(lead);
    // Its last action: a lead reviews, amends and answers by commands, and is at it while they come.
    const last = lastBy.get(lead);
    const lastAt = typeof last?.at === 'string' ? Date.parse(last.at) : undefined;
    const lastLine = last ? lastDone(last) : undefined;
    const recent = lastAt !== undefined && now - lastAt < ACTIVE_MS && lastLine !== undefined;
    // Finding out a spike it took: working, on that task — what it is at, never idle (velada-dress: the lead at
    // t-shell's spike was nowhere on the board).
    const spiking = at ? undefined : view.tasks.find(task => task.status === 'spike' && task.spikedBy === lead);
    if (spiking) {
      return {
        agent: lead,
        kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
        approved: 0,
        status: 'working' as const,
        ...(leadModel ? { model: leadModel } : {}),
        roles: [lead === LEAD ? 'plans, reviews, finishes' : 'reviews'],
        doing: `finds out for ${spiking.id}: ${spiking.spike ?? 'what it needs'}`,
        task: spiking.id,
        ...(typeof last?.at === 'string' ? { signalAt: last.at } : {})
      };
    }

    return {
      agent: lead,
      kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
      approved: 0,
      // Reviewing only at a review it holds: what it did lately with nothing in hand (a look, an answer, an amend) is
      // its last, never "working" — the board showed a lead at work that no task or card named (velada-dress).
      status: at
        ? ('reviewing' as const)
        : lead === LEAD || asking || recent
          ? ('idle' as const)
          : ('not-started' as const),
      ...(leadModel ? { model: leadModel } : {}),
      roles: [lead === LEAD ? 'plans, reviews, finishes' : 'reviews'],
      doing: at
        ? `reviews ${at}`
        : `${lead === LEAD ? 'plans, answers, reviews what no lead took' : asking ? 'waits for a review' : 'reviews when they queue up'}${lastLine ? ` · last: ${lastLine}` : ''}`,
      ...(at ? { task: at } : {}),
      ...(typeof last?.at === 'string' ? { signalAt: last.at } : {})
    };
  });
  const started = new Map((team ? startedAgents(team) : []).map(each => [each.agent, each] as const));
  const names = [...new Set([...started.keys(), ...held.keys()])];
  const paths = runPaths(ctx.root, view.runId);
  const present = new Map(await Promise.all(names.map(async agent => [agent, await presentAt(paths, agent)] as const)));
  // Between tasks and not said to have stopped: there while its follow marks it present, gone once it does not.
  const gone = (agent: string): number | undefined => {
    const last = lastBy.get(agent);
    const seen = Math.max(present.get(agent) ?? 0, typeof last?.at === 'string' ? Date.parse(last.at) : 0);

    return last !== undefined && last.action !== 'stops' && seen > 0 && now - seen > PRESENCE_STALE_MS
      ? Math.round((now - seen) / 60_000)
      : undefined;
  };
  const agents: AgentLine[] = names.map(agent => {
    const task = held.get(agent);
    const member = started.get(agent);
    const also = (holds.get(agent) ?? []).filter(each => each.id !== task?.id);
    const more = [
      ...(also.length > 0
        ? [
            `also holds ${also.map(each => `${each.id} (${each.status === 'changes-requested' ? `sent back, round ${String(each.round)}` : each.status})`).join(', ')}`
          ]
        : []),
      ...(member?.roles.includes('designer') && uiWaiting.length > 0
        ? [`${String(uiWaiting.length)} UI review${uiWaiting.length === 1 ? '' : 's'} wait for a designer`]
        : [])
    ];
    const tail = more.length > 0 ? ` · ${more.join(' · ')}` : '';
    const about = {
      approved: approvedBy.get(agent) ?? 0,
      ...(member?.model ? { model: `${member.model.model}${member.quality ? ` (${member.quality})` : ''}` } : {}),
      roles: member?.roles ?? (task ? [task.role] : [])
    };

    return task
      ? {
          agent,
          kind: 'agent' as const,
          status: statusOf(task),
          ...about,
          doing: `${doingOf(task)}${tail}`,
          task: task.id,
          ...(task.signalAt ? { signalAt: task.signalAt } : {}),
          ...(task.noSignal ? { noSignal: true } : {})
        }
      : finished
        ? // Every task approved: nothing is left for any agent, whatever it said last — velada-now's dev-2 showed
          // "waiting for work" an hour after its agent had gone, design-1 idle.
          {
            agent,
            kind: 'agent' as const,
            status: 'stopped' as const,
            ...about,
            doing: `every task approved — nothing is left for it${tail}`,
            ...(typeof lastBy.get(agent)?.at === 'string' ? { signalAt: String(lastBy.get(agent)?.at) } : {})
          }
        : gone(agent) !== undefined
          ? // Its harness stopped it, or it hangs: nothing marked it present — said, never "waiting" for good.
            {
              agent,
              kind: 'agent' as const,
              status: 'no-signal' as const,
              ...about,
              doing: `no sign of it for ${String(gone(agent))} min — its harness stopped it, or it hangs: start it again${member ? ` (plitzi task next --role ${member.roles.join(',')} --follow --take --agent ${agent})` : ''}${tail}`,
              ...(typeof lastBy.get(agent)?.at === 'string' ? { signalAt: String(lastBy.get(agent)?.at) } : {})
            }
          : member?.onDemand && (lastBy.get(agent) === undefined || lastBy.get(agent)?.action === 'stops')
            ? // On demand, and not running: nothing is wrong — it is started when work waits for it (run watch says).
              {
                agent,
                kind: 'agent' as const,
                status: lastBy.get(agent) === undefined ? ('not-started' as const) : ('stopped' as const),
                ...about,
                doing: `on demand — started when work waits for it${lastBy.get(agent) ? ', stopped when none was left' : ''}${tail}`,
                ...(typeof lastBy.get(agent)?.at === 'string' ? { signalAt: String(lastBy.get(agent)?.at) } : {})
              }
            : {
                agent,
                kind: 'agent' as const,
                // Between tasks: idle — a wait for work is no work, whatever its follow waits for (the line says what);
                // stopped once it said so.
                status: lastBy.get(agent)?.action === 'stops' ? ('stopped' as const) : ('idle' as const),
                ...about,
                doing: `${betweenTasks(agent, lastBy.get(agent))}${tail}`,
                ...(typeof lastBy.get(agent)?.at === 'string' ? { signalAt: String(lastBy.get(agent)?.at) } : {})
              };
  });

  return [...leads, ...agents];
};

const glimpse = (text: string, length = 140): string =>
  text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`;

/** One line of the run's log, said — `undefined` for what is not worth a person's look (a heartbeat, a brake event). */
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const listOf = (value: unknown): string =>
  Array.isArray(value) ? value.filter(each => typeof each === 'string').join(', ') : '';

/** One line of the run's activity, as the feed says it — every action the CLI writes, none left out on purpose. */
const feedOf = (entry: Record<string, unknown>): FeedLine | undefined => {
  const at = textOf(entry.at);
  const by = textOf(entry.by);
  const task = textOf(entry.task);
  const round = typeof entry.round === 'number' ? ` (round ${String(entry.round)})` : '';
  const line = (kind: FeedLine['kind'], text: string): FeedLine => ({ at, by, kind, text, ...(task ? { task } : {}) });
  switch (entry.action) {
    case 'take':
      return line('take', `took ${task}`);
    case 'spike':
      return line('agent', `went back to finding out for ${task}: ${textOf(entry.question)}`);
    case 'spike-done':
      return line(
        entry.status === 'done' ? 'approved' : 'agent',
        `found out for ${task} (${textOf(entry.question)}) — ${entry.status === 'done' ? 'research alone: done' : entry.status === 'pending' || entry.status === 'ready' ? `kept, not built now (${textOf(entry.status)})` : 'building it now'}`
      );
    case 'joined':
      return line('agent', `joined the run${entry.quality ? ` at ${textOf(entry.quality)}` : ''}`);
    case 'complete':
      return line('complete', `sent ${task} to review`);
    case 'check':
      return entry.ok === true
        ? line('other', `checked ${task}: passes`)
        : {
            ...line('problem', `checked ${task}: fails — ${listOf(entry.failed) || 'see its check'}`),
            group: `check:${task}`
          };
    case 'look':
      return line('review', `looked at ${task} (${listOf(entry.paths)})${entry.ok === false ? ': findings' : ''}`);
    case 'review-taken':
      return line('review', `took the ${textOf(entry.review)} review of ${task}`);
    case 'review':
      return entry.verdict === 'approve'
        ? line(
            'approved',
            `approved ${task}${round}${entry.design === 'skipped' ? ` — ${designSkipText(isDesignSkip(entry.designSkip) ? entry.designSkip : undefined)}${typeof entry.designBy === 'string' ? ` (${entry.designBy} had it)` : ''}` : ''}`
          )
        : line('sent-back', `sent ${task} back${round}`);
    case 'handed-on':
      return line(
        'run',
        [
          ...(Array.isArray(entry.granted) && entry.granted.length > 0
            ? [`${task}'s files handed to ${listOf(entry.granted)}`]
            : []),
          ...(Array.isArray(entry.ready) && entry.ready.length > 0 ? [`ready now: ${listOf(entry.ready)}`] : [])
        ].join(' · ')
      );
    case 'design-review':
      return entry.verdict === 'approve'
        ? line('approved', `approved the UI of ${task}`)
        : line('sent-back', `sent ${task}'s UI back${round}`);
    case 'waiting':
      return line('agent', `waits for work — ${textOf(entry.why)}`);
    case 'stops':
      return line('agent', `stops: ${textOf(entry.why)}`);
    case 'settle':
      return line('run', `merged the requests that waited: ${listOf(entry.settled)}`);
    case 'all-approved':
      return line('run', `every task is approved (${String(entry.tasks)}) — next: ${textOf(entry.next)}`);
    case 'ready':
      return line(
        'run',
        `the run is ready: its ${String(entry.files)} files checked whole, ${String(entry.acceptance)} acceptance lines hold — next: ${textOf(entry.next)}`
      );
    case 'note':
      // The note itself is in the feed, in its words, to every task.
      return undefined;
    case 'refused':
      return {
        ...line(
          'problem',
          `refused (${textOf(entry.code)}): ${textOf(entry.command)} — ${textOf(entry.message).slice(0, 160)}`
        ),
        group: `refused:${textOf(entry.code)}:${textOf(entry.command).split(' ').slice(0, 3).join(' ')}`
      };
    case 'crashed':
      return line('problem', `crashed: ${textOf(entry.command)} — ${textOf(entry.error).slice(0, 160)}`);
    case 'preview-sync-failed':
      return line('problem', `the preview did not take ${task} in: ${textOf(entry.error).slice(0, 120)}`);
    case 'ask':
    case 'tell':
      // The message itself is in the feed, in its words: a second line saying it was sent says nothing more.
      return undefined;
    case 'notice':
      return line(
        'message',
        `noticed, owned by no task: ${textOf(entry.text)}${typeof entry.on === 'string' ? ` (on ${entry.on})` : ''}`
      );
    case 'propose':
      return line('message', `proposed ${textOf(entry.proposal)} to ${textOf(entry.to)}`);
    case 'answer':
      return line('message', `answered ${textOf(entry.proposal)}: ${textOf(entry.verdict)}`);
    case 'integration':
      return line('run', `made ${task} for ${textOf(entry.file)}`);
    case 'summary':
      return line('run', 'wrote the run’s summary, its report’s first part');
    case 'message':
      // Each message is in the feed by its own words, read from the messages.
      return undefined;
    case 'stop':
    case 'resume':
    case 'extend':
    case 'amend':
    case 'attach':
    case 'brake':
    case 'open': {
      const said: Record<string, string> = {
        stop: 'stopped the run',
        resume: 'opened the run again',
        extend: `stacked a stage${typeof entry.stage === 'string' ? ` (${entry.stage})` : ''}`,
        amend: `amended the plan${Array.isArray(entry.tasks) ? ` (${entry.tasks.flatMap(each => (isRecord(each) && typeof each.task === 'string' ? [each.task] : [])).join(', ')})` : ''}${Array.isArray(entry.removed) ? `, removed ${listOf(entry.removed)}` : ''}`,
        attach: 'attached the run',
        brake: 'the brake stopped the run',
        open: `opened the run${typeof entry.tasks === 'number' ? ` — ${String(entry.tasks)} tasks${typeof entry.inventory === 'number' ? `, ${String(entry.inventory)} pieces` : ''}` : ''}`
      };

      return line(
        entry.action === 'brake' ? 'problem' : 'run',
        `${said[entry.action] ?? ''}${typeof entry.reason === 'string' ? ` — ${entry.reason}` : ''}`
      );
    }
    default:
      // An action this feed has no words for yet is said as it is written: never dropped.
      return line('other', `${textOf(entry.action)}${task ? ` ${task}` : ''}`);
  }
};

/** The run as `run monitor` shows it, newest of the feed first, `feedLength` of it. */
export const monitorRun = async (ctx: RunContext, runId: string, feedLength = 40): Promise<Monitored> => {
  const view = await viewRun(ctx, runId);
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const log = await readRunLog(loaded.paths);
  const logged = log.flatMap(entry => feedOf(entry) ?? []);
  const stories = storiesOf(log);
  // A task's message is written by its agent: said by that name, the task beside it, as every other line is by who.
  const said = (await messagesOf(loaded)).map((message): FeedLine => {
    const writer = stories[message.from]?.writers.at(-1);
    const asks = message.to === LEAD && message.fyi !== true && writer !== undefined;

    // To a task is to the agent writing it, said by its name with the task beside: who reads it, at a glance.
    const holder = stories[message.to]?.writers.at(-1);
    const to = message.to === '*' ? 'every task' : (holder ?? message.to.replace(/^@/, ''));
    const quote = glimpse(message.text.replace(/\s+/g, ' '));

    return {
      at: message.at,
      by: writer ?? message.from,
      kind: asks ? 'question' : 'message',
      to,
      quote,
      ...(writer === undefined ? (holder === undefined ? {} : { task: message.to }) : { task: message.from }),
      text: `${writer === undefined ? '' : `on ${message.from} `}→ ${to}${message.fyi ? ' (for you to know)' : asks ? ' (asks)' : ''}: ${quote}`
    };
  });
  // A completion's note is sent to the lead as it completes (`task complete --note`): said on the completion's line, not
  // again as a message of its own — one event, one line.
  const notes = new Set<FeedLine>();
  for (const line of logged) {
    const note =
      line.kind === 'complete'
        ? said.find(
            each =>
              each.kind === 'message' &&
              each.task === line.task &&
              each.to === LEAD &&
              Math.abs(Date.parse(each.at) - Date.parse(line.at)) <= NOTE_WITHIN_MS
          )
        : undefined;
    if (note?.quote !== undefined) {
      line.text = `${line.text} — “${note.quote}”`;
      notes.add(note);
    }
  }

  const feed = groupRepeats(
    [...logged, ...said.filter(each => !notes.has(each))].sort((a, b) => b.at.localeCompare(a.at))
  ).slice(0, feedLength);
  const runs = [];
  for (const id of await runIds(ctx.root)) {
    const other = id === runId ? view : await viewRun(ctx, id).catch(() => undefined);
    if (other) {
      runs.push({ runId: id, status: other.status });
    }
  }

  const stacked = log.filter(entry => entry.action === 'extend' && typeof entry.stage === 'string');
  const latest = stacked.at(-1);
  const stage =
    latest && typeof latest.stage === 'string'
      ? {
          name: latest.stage,
          ...(typeof latest.goal === 'string' ? { goal: latest.goal } : {}),
          of: stacked.length + 1
        }
      : undefined;

  return { view, agents: await agentsOf(ctx, view, log, stories), feed, stories, runs, ...(stage ? { stage } : {}) };
};
