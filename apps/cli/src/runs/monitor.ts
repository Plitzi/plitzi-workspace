import { commandDoing, doingOf, statusOf } from './agentDoing';
import { answering, openQuestions } from './answering';
import { isDesignSkip } from './designSkip';
import { feedOf, glimpse, textOf } from './feedLine';
import { LEAD, messagesOf } from './messages';
import { runPaths } from './paths';
import { presentAt, PRESENCE_STALE_MS } from './presence';
import { loadRun, readRunLog, runIds } from './run';
import { choiceText, readTeam, startedAgents } from './team';
import { readUsage } from './usage';
import { viewRun } from './view';
import { isWorked } from './worked';

import type { DesignSkip } from './designSkip';
import type { RunContext } from './run';
import type { UsageLine } from './usage';
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
  /** Started only when work waits for it — past its group's `min`, or a lead that reviews — not with the run. */
  onDemand?: true;
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

/** How long an agent's last command says what it is at: older, it says nothing of now. */
const LATELY_MS = 10 * 60_000;

/** How recent a lead that reviews must have done something to count as started: idle, not waiting to be started. */
const ACTIVE_MS = 3 * 60_000;

/** Every agent: the team's, the leads — what each is at, from the tasks they hold and the reviews they took. */
const agentsOf = async (
  ctx: RunContext,
  view: RunView,
  log: readonly Record<string, unknown>[],
  stories: Partial<Record<string, TaskStory>>,
  usage: readonly UsageLine[] = []
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
  // What each agent ran last, in words: what it is at between the marks its task leaves — "writes t-home" alone said
  // nothing of it, and a person read the rest as noise.
  const lastRun = new Map(usage.map(line => [line.by, line] as const));
  const lately = (agent: string): string => {
    const line = lastRun.get(agent);
    const at = line ? Date.parse(line.at) : Number.NaN;

    return line && now - at < LATELY_MS ? ` — ${commandDoing(line.command)}` : '';
  };
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
  // A run stopped holds everyone: said so, never "waiting for work" while work is there (velada-dress: the brake).
  const betweenTasks = (agent: string, last: Record<string, unknown> | undefined): string =>
    view.status !== 'open'
      ? `waits for the run to go on — it is ${view.status}${view.status === 'stopping' ? ': plitzi run resume' : ''}`
      : last?.action === 'waiting'
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
  const loadedRun = await loadRun(ctx, view.runId, { anyMachine: true, anyVersion: true });
  const taken = await answering(loadedRun);
  const questions = await openQuestions(loadedRun);
  const unanswered = questions.filter(each => !Object.hasOwn(taken, each.id));
  const leads: AgentLine[] = [LEAD, ...view.leads].map(lead => {
    if (finished) {
      return {
        agent: lead,
        kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
        ...(lead === LEAD ? {} : { onDemand: true as const }),
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
    // Answering a question it took: working, on the task that asked — the board names it there too, held on it.
    const question =
      at || spiking ? undefined : questions.find(each => Object.hasOwn(taken, each.id) && taken[each.id].by === lead);
    if (question) {
      return {
        agent: lead,
        kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
        ...(lead === LEAD ? {} : { onDemand: true as const }),
        approved: 0,
        status: 'working' as const,
        ...(leadModel ? { model: leadModel } : {}),
        roles: [lead === LEAD ? 'plans, reviews, finishes' : 'reviews'],
        doing: `answers ${question.from}'s ${question.id}: ${glimpse(question.text, 80)}`,
        task: question.from,
        ...(typeof last?.at === 'string' ? { signalAt: last.at } : {})
      };
    }

    if (spiking) {
      return {
        agent: lead,
        kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
        ...(lead === LEAD ? {} : { onDemand: true as const }),
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
      ...(lead === LEAD ? {} : { onDemand: true as const }),
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
        : // A question no lead took waits on the lead: said on its row, not "idle" over an agent kept waiting.
          lead === LEAD && unanswered.length > 0
          ? `${String(unanswered.length)} question${unanswered.length === 1 ? '' : 's'} wait${unanswered.length === 1 ? 's' : ''} for you: ${unanswered.map(each => `${each.from}'s ${each.id}`).join(', ')}`
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
      ...(member?.onDemand === true ? { onDemand: true as const } : {}),
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
          doing: `${doingOf(task)}${task.step ? '' : lately(agent)}${tail}`,
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
              doing: `no sign of it for ${String(gone(agent))} min — its harness stopped it, or it hangs: the lead starts it again${tail}`,
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
            : lastBy.get(agent) === undefined && present.get(agent) === undefined && !lastRun.has(agent)
              ? // Of the team's base and never started: not idle — nothing of it has run (velada-polish's dev-1 and
                // design-1 read idle before either was started). How to start it is the lead's to read (run watch),
                // never this row's: a person following the run read a command line where an agent should be.
                {
                  agent,
                  kind: 'agent' as const,
                  status: 'not-started' as const,
                  ...about,
                  doing: `not started yet — it starts with the run${tail}`
                }
              : {
                  agent,
                  kind: 'agent' as const,
                  // Between tasks: idle — a wait for work is no work, whatever its follow waits for (the line says what);
                  // stopped once it said so.
                  status: lastBy.get(agent)?.action === 'stops' ? ('stopped' as const) : ('idle' as const),
                  ...about,
                  // Running, before anything of it reached the run's log: what it ran says what it is at.
                  doing: `${lastBy.get(agent) === undefined && lastRun.has(agent) ? `getting started${lately(agent)}` : betweenTasks(agent, lastBy.get(agent))}${tail}`,
                  ...(typeof lastBy.get(agent)?.at === 'string' ? { signalAt: String(lastBy.get(agent)?.at) } : {})
                };
  });

  return [...leads, ...agents];
};

/** The run as `run monitor` shows it, newest of the feed first, `feedLength` of it. */
export const monitorRun = async (ctx: RunContext, runId: string, feedLength = 40): Promise<Monitored> => {
  const view = await viewRun(ctx, runId);
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const usage = readUsage(loaded.paths.dir);
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

  return {
    view,
    agents: await agentsOf(ctx, view, log, stories, usage),
    feed,
    stories,
    runs,
    ...(stage ? { stage } : {})
  };
};
