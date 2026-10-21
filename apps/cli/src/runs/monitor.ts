import { isRecord } from '@plitzi/sdk-shared/helpers';

import { LEAD, messagesOf } from './messages';
import { loadRun, readRunLog, runIds } from './run';
import { choiceText, readTeam, startedAgents } from './team';
import { viewRun } from './view';

import type { RunContext } from './run';
import type { RunView, TaskLine } from './view';

/**
 * What `plitzi run monitor` shows, gathered by reading only: the run, every agent and what it does, and what happened
 * last — takes, completions, reviews and their verdicts, messages — newest first. Nothing is marked read.
 */

/** Where an agent stands, at a glance. */
export type AgentStatus = 'working' | 'reviewing' | 'in-review' | 'blocked' | 'idle' | 'not-started' | 'no-signal';

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
  /** What happened, said. */
  text: string;
  kind: 'take' | 'complete' | 'review' | 'message' | 'run' | 'problem' | 'other';
}

/**
 * What the log says of a task — who wrote it, who said its UI, who approved it and when: what a task approved no longer
 * holds (its owner goes with the approval), and what a person asks of a row of the panel.
 */
export interface TaskStory {
  /** Each agent that took it, in the order they did. */
  writers: string[];
  /** Its first take: the start of its work. */
  takenAt?: string;
  /** The designer that approved its UI, or `skipped` when the lead went first. */
  design?: string;
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
    } else if (entry.action === 'design-review' && by !== undefined) {
      story.design = by;
    } else if (entry.action === 'review' && entry.verdict === 'approve') {
      story.approvedAt = entry.at;
      story.approvedBy = by ?? LEAD;
      if (entry.design === 'skipped') {
        story.design ??= 'skipped';
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
  task.noSignal
    ? 'no-signal'
    : task.status === 'in-review'
      ? 'in-review'
      : task.status === 'blocked' || task.status === 'waiting'
        ? 'blocked'
        : 'working';

const doingOf = (task: TaskLine): string => {
  switch (task.status) {
    case 'in-review':
      return `${task.id} waits for its review`;
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

/** How recent an agent's last action is to be "at it" — a lead reviews by commands, between which it holds nothing. */
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
  const held = new Map<string, TaskLine>();
  const holds = new Map<string, TaskLine[]>();
  for (const task of view.tasks) {
    if (task.agent && task.status !== 'done') {
      holds.set(task.agent, [...(holds.get(task.agent) ?? []), task]);
      // An agent writes one task at a time; one in review it finished is shown only when it holds nothing else.
      const before = held.get(task.agent);
      if (!before || before.status === 'in-review') {
        held.set(task.agent, task);
      }
    }
  }

  // What waits on a designer: a UI review no designer took — said on each designer, which may be at a task of its own.
  const uiWaiting = view.tasks.filter(
    task => task.status === 'in-review' && task.design?.status === 'due' && task.design.by === undefined
  );

  const reviewing = new Map(view.tasks.flatMap(task => (task.reviewer ? [[task.reviewer, task.id] as const] : [])));
  const leadModel = team?.lead?.model === undefined ? undefined : choiceText(team.lead.model);
  const leads: AgentLine[] = [LEAD, ...view.leads].map(lead => {
    const at = reviewing.get(lead);
    const asking = view.askingLeads.includes(lead);
    // Its last action: a lead reviews, amends and answers by commands, and is at it while they come.
    const last = lastBy.get(lead);
    const lastAt = typeof last?.at === 'string' ? Date.parse(last.at) : undefined;
    const lastLine = last ? lastDone(last) : undefined;
    const recent = lastAt !== undefined && now - lastAt < ACTIVE_MS && lastLine !== undefined;
    const lastTask = typeof last?.task === 'string' ? last.task : undefined;

    return {
      agent: lead,
      kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
      approved: 0,
      status:
        at || recent ? ('reviewing' as const) : lead === LEAD || asking ? ('idle' as const) : ('not-started' as const),
      ...(leadModel ? { model: leadModel } : {}),
      roles: [lead === LEAD ? 'plans, reviews, finishes' : 'reviews'],
      doing: at
        ? `reviews ${at}`
        : recent
          ? lastLine
          : `${lead === LEAD ? 'plans, answers, reviews what no lead took' : asking ? 'waits for a review' : 'reviews when they queue up'}${lastLine ? ` · last: ${lastLine}` : ''}`,
      ...(at ? { task: at } : lastTask && recent ? { task: lastTask } : {}),
      ...(typeof last?.at === 'string' ? { signalAt: last.at } : {})
    };
  });
  const started = new Map((team ? startedAgents(team) : []).map(each => [each.agent, each] as const));
  const agents: AgentLine[] = [...new Set([...started.keys(), ...held.keys()])].map(agent => {
    const task = held.get(agent);
    const member = started.get(agent);
    const also = (holds.get(agent) ?? []).filter(each => each.id !== task?.id);
    const more = [
      ...(also.length > 0 ? [`also holds ${also.map(each => `${each.id} (${each.status})`).join(', ')}`] : []),
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
      : {
          agent,
          kind: 'agent' as const,
          status: 'idle' as const,
          ...about,
          doing: `between tasks${lastBy.get(agent) ? ` — last: ${lastDone(lastBy.get(agent) ?? {}) ?? ''}` : ' — not started yet'}${tail}`,
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
  const line = (kind: FeedLine['kind'], text: string): FeedLine => ({ at, by, kind, text });
  switch (entry.action) {
    case 'take':
      return line('take', `took ${task}`);
    case 'joined':
      return line('run', `joined the run${entry.quality ? ` at ${textOf(entry.quality)}` : ''}`);
    case 'complete':
      return line('complete', `sent ${task} to review`);
    case 'check':
      return entry.ok === true
        ? line('other', `checked ${task}: passes`)
        : line('problem', `checked ${task}: fails — ${listOf(entry.failed) || 'see its check'}`);
    case 'look':
      return line('review', `looked at ${task} (${listOf(entry.paths)})${entry.ok === false ? ': findings' : ''}`);
    case 'review-taken':
      return line('review', `took the ${textOf(entry.review)} review of ${task}`);
    case 'review':
      return line(
        'review',
        entry.verdict === 'approve' ? `approved ${task}${round}` : `asked for changes on ${task}${round}`
      );
    case 'design-review':
      return line('review', `approved the UI of ${task}`);
    case 'refused':
      return line(
        'problem',
        `refused (${textOf(entry.code)}): ${textOf(entry.command)} — ${textOf(entry.message).slice(0, 160)}`
      );
    case 'crashed':
      return line('problem', `crashed: ${textOf(entry.command)} — ${textOf(entry.error).slice(0, 160)}`);
    case 'preview-sync-failed':
      return line('problem', `the preview did not take ${task} in: ${textOf(entry.error).slice(0, 120)}`);
    case 'ask':
    case 'tell':
      // The message itself is in the feed, in its words: a second line saying it was sent says nothing more.
      return undefined;
    case 'propose':
      return line('message', `proposed ${textOf(entry.proposal)} to ${textOf(entry.to)}`);
    case 'answer':
      return line('message', `answered ${textOf(entry.proposal)}: ${textOf(entry.verdict)}`);
    case 'integration':
      return line('run', `made ${task} for ${textOf(entry.file)}`);
    case 'event':
      // The brake's count: a refused completion is said, the rest are the lines above.
      return entry.kind === 'refused' ? line('problem', `a completion of ${task || 'a task'} was refused`) : undefined;
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

    return {
      at: message.at,
      by: writer ?? message.from,
      kind: 'message',
      text: `${writer === undefined ? '' : `on ${message.from} `}→ ${message.to === '*' ? 'every task' : message.to}${message.fyi ? ' (for you to know)' : asks ? ' (asks)' : ''}: ${glimpse(message.text.replace(/\s+/g, ' '))}`
    };
  });
  const feed = [...logged, ...said].sort((a, b) => b.at.localeCompare(a.at)).slice(0, feedLength);
  const runs = [];
  for (const id of await runIds(ctx.root)) {
    const other = id === runId ? view : await viewRun(ctx, id).catch(() => undefined);
    if (other) {
      runs.push({ runId: id, status: other.status });
    }
  }

  return { view, agents: await agentsOf(ctx, view, log, stories), feed, stories, runs };
};
