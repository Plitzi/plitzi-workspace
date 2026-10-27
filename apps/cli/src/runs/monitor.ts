import { commandDoing, doingOf, statusOf } from './agentDoing';
import { feedOf, glimpse, SHORT, textOf } from './feedLine';
import { leadWatching } from './leadWatch';
import { LEAD, messagesOf, openQuestions } from './messages';
import { stoppedAgents } from './onDemand';
import { runPaths } from './paths';
import { presentAt, PRESENCE_STALE_MS } from './presence';
import { isApproval, loadRun, readRunLog, runIds } from './run';
import { spentOf, spentPerMinute, SPEND_MINUTES } from './spent';
import { choiceText, FRESH_CONTEXT_AT, readTeam, startedAgents } from './team';
import { readUsage } from './usage';
import { viewRun } from './view';
import { isWorked } from './worked';

import type { RunContext } from './run';
import type { Spent } from './spent';
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
  | 'away'
  | 'blocked'
  | 'asking'
  | 'waiting'
  | 'idle'
  | 'stopped'
  | 'restarting'
  | 'done'
  | 'not-started'
  | 'no-signal';

export interface AgentLine {
  agent: string;
  kind: 'lead' | 'agent';
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
  /** What happened, said for a glance — `SHORT` at most (`feedLine.ts`). */
  text: string;
  /** The whole of it, when `text` says less: what a person opens the line to read. */
  detail?: string;
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
  /** The steps of its review approved before its last, each with who said it: `designer by design-1`. */
  passed?: string[];
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
  /** What each agent's harness spent so far, the most read first (`spent.ts`). */
  spend: Spent[];
  /** The run's tokens in each of its last `SPEND_MINUTES` minutes, the oldest first: the spend's chart. */
  perMinute: number[];
  /** The agents started again only once their context passes a size (`"session": "context"`), each with that size. */
  freshAt: ReadonlyMap<string, number>;
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
    } else if (
      entry.verdict === 'approve' &&
      by !== undefined &&
      // A step before its last: its review goes on.
      entry.action === 'review' &&
      !isApproval(entry)
    ) {
      const role = typeof entry.step === 'string' ? entry.step : 'review';
      story.passed = [...(story.passed ?? []), `${role} by ${by}`];
    } else if (isApproval(entry)) {
      story.approvedAt = entry.at;
      story.approvedBy = by ?? LEAD;
    } else if (entry.action === 'review') {
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
    default: {
      // The feed's line leaves its task to a column of its own; a row of the agents has none, so it names it first.
      const line = feedOf(entry);

      return line && (line.task ? `${line.task}: ${line.text}` : line.text);
    }
  }
};

/** A task's line without the step its writer gave: what a reviewer is at is said by its own. */
const withoutStep = ({ step: _written, ...line }: TaskLine): Omit<TaskLine, 'step'> => line;

/** How long a lead neither watching the run nor running a command of it is still deciding, not away from it. */
export const LEAD_AWAY_MS = 2 * 60_000;

const clockOf = (at: string): string => at.slice(11, 16);

/** How long an agent's last command says what it is at: older, it says nothing of now. */
const LATELY_MS = 10 * 60_000;

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
    // An agent the run asked for and its keeper started is no act of the lead's, whose token the keeper uses.
    if (typeof entry.by === 'string' && lastDone(entry) !== undefined && entry.asked !== true) {
      lastBy.set(entry.by, entry);
    }
  }

  const stopped = stoppedAgents(log);
  const now = ctx.now().getTime();
  // What an agent said it is at on a review or a research card (`task progress --step`), noted in the log — a card's
  // own record keeps only a task's at work: a tester and a scout read as their card alone. Said anew each time it
  // takes the card.
  const steps = new Map<string, string>();
  for (const entry of log) {
    const key = `${String(entry.by)}|${String(entry.task)}`;
    if (entry.action === 'take' || entry.action === 'review-taken') {
      steps.delete(key);
    } else if (entry.action === 'progress' && typeof entry.step === 'string' && entry.step !== '') {
      steps.set(key, entry.step);
    }
  }

  const stepOf = (agent: string, task: string): string | undefined => steps.get(`${agent}|${task}`);
  // What each agent ran last, in words: what it is at between the marks its task leaves — "writes t-home" alone said
  // nothing of it, and a person read the rest as noise.
  const lastRun = new Map(usage.map(line => [line.by, line] as const));
  const lately = (agent: string): string => {
    const line = lastRun.get(agent);
    const at = line ? Date.parse(line.at) : Number.NaN;

    return line && now - at < LATELY_MS ? ` — ${commandDoing(line)}` : '';
  };
  const team = await readTeam(ctx.root).catch(() => undefined);
  // A task is whoever is at it: its writer while it is written or sent back, its reviewer at the step of its review.
  // Its writer is free once it went to review.
  const assignee = (task: TaskLine): string | undefined => (task.status === 'in-review' ? task.review?.by : task.agent);
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
  // A run stopped holds everyone: said so, never "waiting for work" while work is there (the brake).
  const betweenTasks = (agent: string, last: Record<string, unknown> | undefined): string =>
    view.status !== 'open'
      ? `waits for the run to go on — it is ${view.status}${view.status === 'stopping' ? ': plitzi run resume' : ''}`
      : last?.action === 'waiting'
        ? `${tookAny.has(agent) ? 'waiting for work' : 'waiting for its first task'} — ${standing}`
        : `between tasks${last ? ` — last: ${lastDone(last) ?? ''}` : ' — not started yet'}`;
  /**
   * An agent stopped between two pieces of work for a fresh context, and not back at work yet: restarting — neither
   * stopped (it comes back) nor idle (it is not there to take work). A run's design-1 read "stopped" the while.
   */
  const restartingOf = (agent: string): string | undefined => {
    // Its own last word, whatever it was: any command of it after the stop says it is back.
    const last = log.findLast(entry => entry.by === agent);
    // Stopped for a fresh context, as its stop says — never read off the stop's words.
    if (last?.action !== 'stops' || last.fresh !== true) {
      return undefined;
    }

    const launched = log.some(
      entry => entry.action === 'launch' && entry.agent === agent && String(entry.at) >= String(last.at)
    );

    if (launched) {
      return 'started again with a fresh context — reading in before it takes what comes';
    }

    // Only one the run starts again is restarting: of the team's base, or one on demand the run asks for now. One on
    // demand with nothing for it rests — a run's dev-2 read "restarting" two hours, nothing left for it.
    const asked = view.attention.some(item => item.kind === 'agents-needed' && item.agent === agent);
    if (teamMember(agent)?.onDemand === true && !asked) {
      return undefined;
    }

    return 'restarting with a fresh context — the run starts it again for what comes';
  };
  const teamMember = (agent: string) => (team ? startedAgents(team) : []).find(each => each.agent === agent);
  // Steps nobody took yet, by role: said on each agent of that role, which may be at a task of its own.
  const untaken = view.tasks.flatMap(task =>
    task.status === 'in-review' && task.review !== undefined && task.review.by === undefined ? [task.review.role] : []
  );

  const reviewing = new Map(
    view.tasks.flatMap(task => (task.review?.by !== undefined ? [[task.review.by, task.id] as const] : []))
  );
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
  const unanswered = await openQuestions(loadedRun);
  const watching = await leadWatching(loadedRun.paths.leadWatching);
  const leadLine = (): AgentLine => {
    const base = {
      agent: LEAD,
      kind: 'lead' as const,
      approved: 0,
      ...(leadModel ? { model: leadModel } : {}),
      roles: ['plans, decides, finishes']
    };
    if (finished) {
      return { ...base, status: 'done' as const, doing: nextStep };
    }

    const at = reviewing.get(LEAD);
    // Its last act — opening the run, a verdict, a stage stacked — is done once it is logged, the work handed to an
    // agent: said as its last, never as work.
    const last = lastBy.get(LEAD);
    const lastLine = last ? lastDone(last) : undefined;
    // Finding out research with no scout in the team: working, never idle.
    const spiking = at ? undefined : view.tasks.find(task => task.leadFindsOut === true);
    if (spiking) {
      return {
        ...base,
        status: 'working' as const,
        doing: `finds out for ${spiking.id}: ${spiking.spike ?? 'what it needs'}`,
        task: spiking.id,
        ...(typeof last?.at === 'string' ? { signalAt: last.at } : {})
      };
    }

    const proposed = view.tasks.filter(task => task.proposed !== undefined);
    // Neither watching the run nor running a command of it for a while: the lead is at something else — the person's,
    // most often — and what needs it waits; the row said "idle" over a lead nobody could reach.
    const heard = Math.max(
      Date.parse(loadedRun.record.openedAt),
      ...usage.filter(line => line.by === LEAD).map(line => Date.parse(line.at) + line.ms)
    );
    const waitsOnLead = view.attention.filter(item => item.who === 'lead').length;
    const away = !at && watching === undefined && now - heard > LEAD_AWAY_MS;

    // As every agent's, its state is what it holds on the board — a step of a review; research with no scout, above —
    // never guessed from what it did lately: a run's monitor said the lead was "working" for three minutes after
    // it opened the run, its scout at the scope.
    if (away) {
      return {
        ...base,
        status: 'away' as const,
        doing: `away from the run since ${clockOf(new Date(heard).toISOString())} UTC — at something else, the person's or its own${waitsOnLead > 0 ? `: ${String(waitsOnLead)} thing${waitsOnLead === 1 ? '' : 's'} of the run wait${waitsOnLead === 1 ? 's' : ''} for it` : ''}`,
        signalAt: new Date(heard).toISOString()
      };
    }

    return {
      ...base,
      status: at ? ('reviewing' as const) : watching ? ('waiting' as const) : ('idle' as const),
      doing: at
        ? `reviews ${at}`
        : // What waits on the lead is said on its row first, not "idle" over an agent kept waiting.
          proposed.length > 0
          ? `${proposed.map(task => task.id).join(', ')}: tasks proposed, to decide with the person`
          : unanswered.length > 0
            ? `${String(unanswered.length)} question${unanswered.length === 1 ? '' : 's'} wait${unanswered.length === 1 ? 's' : ''} for you: ${unanswered.map(each => `${each.from}'s ${each.id}`).join(', ')}`
            : watching
              ? `watches the run since ${clockOf(watching.at)} UTC — woken the moment something needs it${lastLine ? ` · last: ${lastLine}` : ''}`
              : `plans, answers, decides what is escalated${lastLine ? ` · last: ${lastLine}` : ''}${lately(LEAD)}`,
      ...(at ? { task: at } : {}),
      ...(typeof last?.at === 'string' ? { signalAt: last.at } : {})
    };
  };
  const leads: AgentLine[] = [leadLine()];
  const started = new Map((team ? startedAgents(team) : []).map(each => [each.agent, each] as const));
  const names = [...new Set([...started.keys(), ...held.keys()])];
  const paths = runPaths(ctx.root, view.runId);
  const present = new Map(await Promise.all(names.map(async agent => [agent, await presentAt(paths, agent)] as const)));
  // Between tasks and not said to have stopped: there while its follow marks it present, gone once it does not.
  const gone = (agent: string): number | undefined => {
    const last = lastBy.get(agent);
    const seen = Math.max(present.get(agent) ?? 0, typeof last?.at === 'string' ? Date.parse(last.at) : 0);

    return last !== undefined &&
      !stopped.has(agent) &&
      !view.gone.includes(agent) &&
      seen > 0 &&
      now - seen > PRESENCE_STALE_MS
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
      ...(member?.roles
        .filter(role => role !== 'developer')
        .flatMap(role => {
          const waiting = untaken.filter(each => each === role).length;

          return waiting > 0 ? [`${String(waiting)} ${role}'s review${waiting === 1 ? '' : 's'} wait`] : [];
        }) ?? [])
    ];
    const tail = more.length > 0 ? ` · ${more.join(' · ')}` : '';
    const about = {
      ...(member?.onDemand === true ? { onDemand: true as const } : {}),
      approved: approvedBy.get(agent) ?? 0,
      ...(member?.model ? { model: `${member.model.model}${member.quality ? ` (${member.quality})` : ''}` } : {}),
      roles: member?.roles ?? (task ? [task.role] : [])
    };

    // What it holds is said with whether anything is at it: a card held by an agent whose process ended, or that is
    // being started again, is no work going on — it read "working" until its signal ran out (Carlos: a person reads
    // the status for what is happening).
    const holding = task?.id ?? reviewing.get(agent);
    const away =
      holding === undefined
        ? undefined
        : restartingOf(agent) !== undefined
          ? { status: 'restarting' as const, doing: `${String(restartingOf(agent))} — then ${holding}` }
          : view.gone.includes(agent)
            ? {
                status: 'stopped' as const,
                doing: `holds ${holding} — its process ended: it is started again when the run asks (run watch)`
              }
            : undefined;

    // A tester at a review: at work on that card — never idle.
    const reviews = task ? undefined : reviewing.get(agent);
    if (reviews) {
      const reviewStep = stepOf(agent, reviews);

      return {
        agent,
        kind: 'agent' as const,
        status: away?.status ?? ('reviewing' as const),
        ...about,
        doing: `${away?.doing ?? `reviews ${reviews}${reviewStep === undefined ? lately(agent) : ` — ${reviewStep}`}`}${tail}`,
        task: reviews,
        ...(typeof lastBy.get(agent)?.at === 'string' ? { signalAt: String(lastBy.get(agent)?.at) } : {})
      };
    }

    // In review, the step is its reviewer's: the one its writer gave last is of the work, not of the review.
    const step =
      task === undefined
        ? undefined
        : task.status === 'in-review'
          ? stepOf(agent, task.id)
          : (task.step ?? stepOf(agent, task.id));

    return task
      ? {
          agent,
          kind: 'agent' as const,
          status: away?.status ?? statusOf(task),
          ...about,
          doing: `${away?.doing ?? `${doingOf({ ...withoutStep(task), ...(step === undefined ? {} : { step }) })}${step === undefined ? lately(agent) : ''}`}${tail}`,
          task: task.id,
          ...(task.signalAt ? { signalAt: task.signalAt } : {}),
          ...(task.noSignal && away === undefined ? { noSignal: true } : {})
        }
      : finished
        ? // Every task approved: nothing is left for any agent, whatever it said last — a run's dev-2 showed
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
          : member?.onDemand &&
              restartingOf(agent) === undefined &&
              (lastBy.get(agent) === undefined || stopped.has(agent) || view.gone.includes(agent))
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
              ? // Of the team's base and never started: not idle — nothing of it has run (a run's dev-1 and
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
                  status: restartingOf(agent)
                    ? ('restarting' as const)
                    : stopped.has(agent) || view.gone.includes(agent)
                      ? ('stopped' as const)
                      : ('idle' as const),
                  ...about,
                  // Running, before anything of it reached the run's log: what it ran says what it is at. Its process
                  // gone with no stop said: ended, its last word a wait (a run's designers read idle for good).
                  doing: `${restartingOf(agent) ?? `${view.gone.includes(agent) && !stopped.has(agent) ? 'its process ended — ' : ''}${lastBy.get(agent) === undefined && lastRun.has(agent) ? `getting started${lately(agent)}` : betweenTasks(agent, lastBy.get(agent))}`}${tail}`,
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
    const whole = message.text.replace(/\s+/g, ' ');
    const quote = glimpse(whole, SHORT - 1);

    return {
      at: message.at,
      by: writer ?? message.from,
      kind: asks ? 'question' : 'message',
      to,
      quote,
      ...(writer === undefined ? (holder === undefined ? {} : { task: message.to }) : { task: message.from }),
      text: `${writer === undefined ? '' : `on ${message.from} `}→ ${to}${message.fyi ? ' (for you to know)' : asks ? ' (asks)' : ''}: ${quote}`,
      ...(quote === whole ? {} : { detail: whole })
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
      line.detail = `${line.detail ?? line.text} — “${note.detail ?? note.quote}”`;
      line.text = glimpse(`${line.text} — “${note.quote}”`, SHORT - 1);
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

  const team = await readTeam(ctx.root).catch(() => undefined);

  return {
    view,
    agents: await agentsOf(ctx, view, log, stories, usage),
    feed,
    stories,
    spend: spentOf(log, usage),
    perMinute: spentPerMinute(log, ctx.now(), SPEND_MINUTES),
    freshAt: new Map(
      (team ? startedAgents(team) : [])
        .filter(each => each.session === 'context')
        .map(each => [each.agent, team?.options?.freshContextAt ?? FRESH_CONTEXT_AT] as const)
    ),
    runs,
    ...(stage ? { stage } : {})
  };
};
