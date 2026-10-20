import fs from 'node:fs/promises';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { LEAD, messagesOf } from './messages';
import { loadRun, runIds } from './run';
import { readTeam, startedAgents } from './team';
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
}

export interface FeedLine {
  at: string;
  by: string;
  /** What happened, said. */
  text: string;
  kind: 'take' | 'complete' | 'review' | 'message' | 'run' | 'other';
}

export interface Monitored {
  view: RunView;
  agents: AgentLine[];
  feed: FeedLine[];
  /** Every run of the project, this one among them: which is shown, and that there are others. */
  runs: { runId: string; status: string }[];
}

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

/** Every agent: the team's, the leads — what each is at, from the tasks they hold and the reviews they took. */
const agentsOf = async (ctx: RunContext, view: RunView): Promise<AgentLine[]> => {
  const team = await readTeam(ctx.root).catch(() => undefined);
  const held = new Map<string, TaskLine>();
  for (const task of view.tasks) {
    if (task.agent && task.status !== 'done') {
      // An agent holds one task it writes; one in review it finished is shown only when it holds nothing else.
      const before = held.get(task.agent);
      if (!before || before.status === 'in-review') {
        held.set(task.agent, task);
      }
    }
  }

  const reviewing = new Map(view.tasks.flatMap(task => (task.reviewer ? [[task.reviewer, task.id] as const] : [])));
  const leadModel = team?.lead?.model;
  const leads: AgentLine[] = [LEAD, ...view.leads].map(lead => {
    const at = reviewing.get(lead);
    const asking = view.askingLeads.includes(lead);

    return {
      agent: lead,
      kind: lead === LEAD ? ('lead' as const) : ('co-lead' as const),
      status: at ? ('reviewing' as const) : lead === LEAD || asking ? ('idle' as const) : ('not-started' as const),
      ...(leadModel ? { model: leadModel } : {}),
      roles: [lead === LEAD ? 'plans, reviews, finishes' : 'reviews'],
      doing: at
        ? `reviews ${at}`
        : lead === LEAD
          ? 'plans, answers, reviews what no lead took'
          : view.askingLeads.includes(lead)
            ? 'waits for a review'
            : 'reviews when they queue up',
      ...(at ? { task: at } : {})
    };
  });
  const started = new Map((team ? startedAgents(team) : []).map(each => [each.agent, each] as const));
  const agents: AgentLine[] = [...new Set([...started.keys(), ...held.keys()])].map(agent => {
    const task = held.get(agent);
    const member = started.get(agent);
    const about = {
      ...(member?.model ? { model: member.model.model } : {}),
      roles: member?.roles ?? (task ? [task.role] : [])
    };

    return task
      ? {
          agent,
          kind: 'agent' as const,
          status: statusOf(task),
          ...about,
          doing: doingOf(task),
          task: task.id,
          ...(task.signalAt ? { signalAt: task.signalAt } : {}),
          ...(task.noSignal ? { noSignal: true } : {})
        }
      : { agent, kind: 'agent' as const, status: 'idle' as const, ...about, doing: 'between tasks — waits for one' };
  });

  return [...leads, ...agents];
};

const glimpse = (text: string, length = 140): string =>
  text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`;

/** One line of the run's log, said — `undefined` for what is not worth a person's look (a heartbeat, a brake event). */
const feedOf = (entry: Record<string, unknown>): FeedLine | undefined => {
  const at = typeof entry.at === 'string' ? entry.at : '';
  const by = typeof entry.by === 'string' ? entry.by : '';
  const task = typeof entry.task === 'string' ? entry.task : '';
  switch (entry.action) {
    case 'take':
      return { at, by, kind: 'take', text: `took ${task}` };
    case 'complete':
      return { at, by, kind: 'complete', text: `sent ${task} to review` };
    case 'review':
      return {
        at,
        by,
        kind: 'review',
        text:
          entry.verdict === 'approve'
            ? `approved ${task}${typeof entry.round === 'number' ? ` (round ${String(entry.round)})` : ''}`
            : `asked for changes on ${task}${typeof entry.round === 'number' ? ` (round ${String(entry.round)})` : ''}`
      };
    case 'design-review':
      return { at, by, kind: 'review', text: `approved the UI of ${task}` };
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
        amend: 'amended the plan',
        attach: 'attached the run',
        brake: 'the brake stopped the run',
        open: 'opened the run'
      };

      return {
        at,
        by,
        kind: 'run',
        text: `${said[entry.action] ?? ''}${typeof entry.reason === 'string' ? ` — ${entry.reason}` : ''}`
      };
    }
    default:
      return undefined;
  }
};

const readLog = async (file: string): Promise<Record<string, unknown>[]> => {
  const text = await fs.readFile(file, 'utf-8').catch(() => '');

  return text.split('\n').flatMap(line => {
    if (line.trim() === '') {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(line);

      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
};

/** The run as `run monitor` shows it, newest of the feed first, `feedLength` of it. */
export const monitorRun = async (ctx: RunContext, runId: string, feedLength = 40): Promise<Monitored> => {
  const view = await viewRun(ctx, runId);
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const logged = (await readLog(loaded.paths.log)).flatMap(entry => feedOf(entry) ?? []);
  const said = (await messagesOf(loaded)).map((message): FeedLine => ({
    at: message.at,
    by: message.from,
    kind: 'message',
    text: `→ ${message.to === '*' ? 'every task' : message.to}${message.fyi ? ' (for you to know)' : ''}: ${glimpse(message.text.replace(/\s+/g, ' '))}`
  }));
  const feed = [...logged, ...said].sort((a, b) => b.at.localeCompare(a.at)).slice(0, feedLength);
  const runs = [];
  for (const id of await runIds(ctx.root)) {
    const other = id === runId ? view : await viewRun(ctx, id).catch(() => undefined);
    if (other) {
      runs.push({ runId: id, status: other.status });
    }
  }

  return { view, agents: await agentsOf(ctx, view), feed, runs };
};
