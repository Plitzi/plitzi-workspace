import type { UsageLine } from './usage';

/**
 * A run measured from its own records — its activity, the usage each command kept, the messages — as the lead measured
 * velada-polish by hand to find where its time went: how long each task waited to be taken, was worked, waited for its
 * UI review and the lead's, and for its agent after it was sent back; how long each agent waited for work; every check
 * failed by its step; every refusal by its code; how long a question waited; and what the run cost — what each command
 * printed, which its agent read — with the calls repeated. The report says it, and keeps it as data, the bench's.
 */

type Entry = Record<string, unknown>;

export interface TaskFlow {
  task: string;
  agents: string[];
  /** From the moment it was stacked to its first take. */
  toTake?: number;
  /** Minutes at work: each take, or each return to it after a review, to its next `complete`. */
  worked: number;
  rounds: { ui: number; lead: number };
  /** Each wait, after a `complete`, for a designer to take its UI review. */
  uiWaits: number[];
  /** Each UI review, from taken to said. */
  uiReviews: number[];
  /** Each wait for the lead's verdict, from the UI approved (or the `complete`, with none) to it. */
  leadWaits: number[];
  /** Each wait, after changes were asked, for an agent to be at it again. */
  reworkWaits: number[];
  handOffs: number;
  checks: { run: number; failed: number };
}

export interface AgentFlow {
  agent: string;
  joinedAt?: string;
  stoppedAt?: string;
  tasks: string[];
  completes: number;
  checks: { run: number; failed: number };
  refused: number;
  /** Minutes it waited for work: from each `waiting` to what it did next. */
  waited: number;
  reviews: { ui: number; uiChanges: number; lead: number; leadChanges: number; medianMinutes?: number };
  /** What the CLI printed to it — read as tokens, a token four characters. */
  calls: number;
  readTokens: number;
  /** The harness's own count, as the lead said it (`run report --tokens`). */
  tokens?: number;
}

export interface RepeatedCall {
  by: string;
  command: string;
  times: number;
  /** Over how many minutes. */
  within: number;
}

export interface RunMetrics {
  /** Opened to every task approved: the run's own work. */
  workMinutes?: number;
  /** Every task approved to now — the finish, a person's — when it was. */
  afterMinutes?: number;
  tasks: TaskFlow[];
  agents: AgentFlow[];
  checks: { run: number; failed: number; byStep: Record<string, number> };
  refusals: { total: number; byCode: Record<string, { times: number; by: string[]; command?: string }> };
  questions: { asked: number; answered: number; waits: number[] };
  handOffs: number;
  cost: {
    calls: number;
    readTokens: number;
    /** The harness's tokens, every agent's the lead said. */
    tokens?: number;
    byCommand: { command: string; calls: number; readTokens: number }[];
    repeated: RepeatedCall[];
  };
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];
const minutes = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 6_000) / 10;

/** The command's name, without what it is about: `task check`, `page shot`. */
export const commandName = (command: string): string =>
  command
    .split(' ')
    .slice(1)
    .filter(word => !word.startsWith('-'))
    .slice(0, 2)
    .join(' ');

const median = (values: readonly number[]): number | undefined => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length === 0 ? undefined : sorted[Math.floor((sorted.length - 1) / 2)];
};

/** How many times a call the same agent made, the same, counts as repeated — and within how many minutes. */
const REPEATED = 3;
const REPEAT_WINDOW_MIN = 10;

const repeatedCalls = (usage: readonly UsageLine[]): RepeatedCall[] => {
  const groups = new Map<string, UsageLine[]>();
  for (const line of usage) {
    const key = `${line.by}\u0000${line.command}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  return [...groups.values()]
    .flatMap(lines => {
      // The longest run of it within the window: a loop on one call, not one run again an hour later.
      let best = { times: 0, within: 0 };
      for (let start = 0; start < lines.length; start += 1) {
        let end = start;
        while (end + 1 < lines.length && minutes(lines[start].at, lines[end + 1].at) <= REPEAT_WINDOW_MIN) {
          end += 1;
        }

        if (end - start + 1 > best.times) {
          best = { times: end - start + 1, within: minutes(lines[start].at, lines[end].at) };
        }
      }

      return best.times >= REPEATED ? [{ by: lines[0].by, command: lines[0].command, ...best }] : [];
    })
    .sort((a, b) => b.times - a.times);
};

export const runMetrics = (input: {
  log: readonly Entry[];
  usage: readonly UsageLine[];
  /** The messages that answer another, with when: a question's wait. */
  answers: readonly { replyTo: string; at: string }[];
  tokens: Readonly<Record<string, number>>;
  taskIds: readonly string[];
  openedAt: string;
  now: string;
}): RunMetrics => {
  const { log, usage } = input;
  const at = (entry: Entry): string => text(entry.at);
  const ofTask = (id: string) => log.filter(entry => entry.task === id);
  // When each task came into the run: at the open, or with the stage that stacked it.
  const stackedAt = new Map<string, string>();
  for (const entry of log) {
    const added = entry.action === 'open' ? texts(entry.taskIds) : entry.action === 'extend' ? texts(entry.added) : [];
    added.filter(id => !stackedAt.has(id)).forEach(id => stackedAt.set(id, at(entry)));
  }

  const tasks: TaskFlow[] = input.taskIds.map(id => {
    const entries = ofTask(id);
    const flow: TaskFlow = {
      task: id,
      agents: [...new Set(entries.filter(entry => entry.action === 'take').map(entry => text(entry.by)))],
      worked: 0,
      rounds: { ui: 0, lead: 0 },
      uiWaits: [],
      uiReviews: [],
      leadWaits: [],
      reworkWaits: [],
      handOffs: entries.filter(entry => entry.action === 'handed-off').length,
      checks: {
        run: entries.filter(entry => entry.action === 'check').length,
        failed: entries.filter(entry => entry.action === 'check' && entry.ok === false).length
      }
    };
    const firstTake = entries.find(entry => entry.action === 'take');
    const stacked = stackedAt.get(id);
    if (firstTake && stacked) {
      flow.toTake = minutes(stacked, at(firstTake));
    }

    let workingSince: string | undefined;
    let sentAt: string | undefined;
    let uiTakenAt: string | undefined;
    let leadSince: string | undefined;
    let sentBackAt: string | undefined;
    for (const entry of entries) {
      const when = at(entry);
      const byOwner = ['take', 'check', 'complete', 'resumes', 'look'].includes(text(entry.action));
      if (sentBackAt !== undefined && byOwner && entry.action !== 'look') {
        flow.reworkWaits.push(minutes(sentBackAt, when));
        sentBackAt = undefined;
        workingSince = when;
      }

      switch (entry.action) {
        case 'take':
          workingSince = when;
          break;
        case 'complete':
          if (workingSince !== undefined) {
            flow.worked += minutes(workingSince, when);
          }

          workingSince = undefined;
          sentAt = when;
          leadSince = entry.review === 'ui' ? undefined : when;
          break;
        case 'review-taken':
          if (entry.review === 'ui' && sentAt !== undefined) {
            flow.uiWaits.push(minutes(sentAt, when));
            uiTakenAt = when;
          }

          break;
        case 'design-review':
          if (uiTakenAt !== undefined) {
            flow.uiReviews.push(minutes(uiTakenAt, when));
          }

          uiTakenAt = undefined;
          if (entry.verdict === 'approve') {
            leadSince = when;
          } else {
            flow.rounds.ui += 1;
            sentBackAt = when;
          }

          break;
        case 'review':
          if (leadSince !== undefined || sentAt !== undefined) {
            flow.leadWaits.push(minutes(leadSince ?? sentAt ?? when, when));
          }

          leadSince = undefined;
          if (entry.verdict === 'changes') {
            flow.rounds.lead += 1;
            sentBackAt = when;
          }

          break;
        default:
          break;
      }
    }

    return flow;
  });

  const names = [
    ...new Set([
      ...log.map(entry => text(entry.by)).filter(Boolean),
      ...usage.map(line => line.by),
      ...Object.keys(input.tokens)
    ])
  ].filter(name => name !== 'plitzi' && name !== 'unnamed');
  const agents: AgentFlow[] = names.map(agent => {
    const own = log.filter(entry => entry.by === agent);
    let waited = 0;
    own.forEach((entry, index) => {
      if (entry.action !== 'waiting') {
        return;
      }

      const next = own.slice(index + 1).find(each => each.action !== 'waiting');
      waited += minutes(at(entry), next ? at(next) : input.now);
    });
    const reviewTimes: number[] = [];
    own
      .filter(entry => entry.action === 'design-review' || entry.action === 'review')
      .forEach(entry => {
        const taken = own.findLast(
          each => each.action === 'review-taken' && each.task === entry.task && at(each) <= at(entry)
        );
        if (taken) {
          reviewTimes.push(minutes(at(taken), at(entry)));
        }
      });
    const calls = usage.filter(line => line.by === agent);
    const middle = median(reviewTimes);

    return {
      agent,
      ...(own.find(entry => entry.action === 'joined')
        ? { joinedAt: at(own.find(entry => entry.action === 'joined') ?? {}) }
        : {}),
      ...(own.findLast(entry => entry.action === 'stops')
        ? { stoppedAt: at(own.findLast(entry => entry.action === 'stops') ?? {}) }
        : {}),
      tasks: [...new Set(own.filter(entry => entry.action === 'take').map(entry => text(entry.task)))],
      completes: own.filter(entry => entry.action === 'complete').length,
      checks: {
        run: own.filter(entry => entry.action === 'check').length,
        failed: own.filter(entry => entry.action === 'check' && entry.ok === false).length
      },
      refused: own.filter(entry => entry.action === 'refused').length,
      waited: Math.round(waited * 10) / 10,
      reviews: {
        ui: own.filter(entry => entry.action === 'design-review').length,
        uiChanges: own.filter(entry => entry.action === 'design-review' && entry.verdict === 'changes').length,
        lead: own.filter(entry => entry.action === 'review').length,
        leadChanges: own.filter(entry => entry.action === 'review' && entry.verdict === 'changes').length,
        ...(middle === undefined ? {} : { medianMinutes: middle })
      },
      calls: calls.length,
      readTokens: Math.round(calls.reduce((sum, line) => sum + line.chars, 0) / 4),
      ...(Object.hasOwn(input.tokens, agent) ? { tokens: input.tokens[agent] } : {})
    };
  });

  const byStep: Record<string, number> = {};
  for (const entry of log.filter(each => each.action === 'check' && each.ok === false)) {
    for (const failed of texts(entry.failed)) {
      // An acceptance line or a long file is said by its kind: the step, not its words, is what is counted.
      const step = failed.startsWith('acceptance')
        ? 'acceptance'
        : / is \d+ non-blank lines/.test(failed)
          ? 'long file'
          : failed;
      byStep[step] = (byStep[step] ?? 0) + 1;
    }
  }

  const byCode: RunMetrics['refusals']['byCode'] = {};
  for (const entry of log.filter(each => each.action === 'refused')) {
    const code = text(entry.code) || 'unknown';
    const was = byCode[code] ?? { times: 0, by: [] };
    byCode[code] = {
      times: was.times + 1,
      by: [...new Set([...was.by, text(entry.by)])],
      ...(was.command !== undefined
        ? { command: was.command }
        : typeof entry.command === 'string'
          ? { command: entry.command }
          : {})
    };
  }

  const asked = log.filter(entry => entry.action === 'ask');
  const waits = asked.flatMap(entry => {
    const answer = input.answers.find(each => each.replyTo === text(entry.message));

    return answer ? [minutes(at(entry), answer.at)] : [];
  });
  const allApproved = log.findLast(entry => entry.action === 'all-approved');
  const byCommand = new Map<string, { calls: number; chars: number }>();
  for (const line of usage) {
    const name = commandName(line.command);
    const was = byCommand.get(name) ?? { calls: 0, chars: 0 };
    byCommand.set(name, { calls: was.calls + 1, chars: was.chars + line.chars });
  }

  const tokens = Object.values(input.tokens);

  return {
    ...(allApproved
      ? { workMinutes: minutes(input.openedAt, at(allApproved)), afterMinutes: minutes(at(allApproved), input.now) }
      : {}),
    tasks,
    agents,
    checks: {
      run: log.filter(entry => entry.action === 'check').length,
      failed: log.filter(entry => entry.action === 'check' && entry.ok === false).length,
      byStep
    },
    refusals: { total: log.filter(entry => entry.action === 'refused').length, byCode },
    questions: { asked: asked.length, answered: waits.length, waits },
    handOffs: log.filter(entry => entry.action === 'handed-off').length,
    cost: {
      calls: usage.length,
      readTokens: Math.round(usage.reduce((sum, line) => sum + line.chars, 0) / 4),
      ...(tokens.length > 0 ? { tokens: tokens.reduce((sum, each) => sum + each, 0) } : {}),
      byCommand: [...byCommand]
        .map(([command, each]) => ({ command, calls: each.calls, readTokens: Math.round(each.chars / 4) }))
        .sort((a, b) => b.readTokens - a.readTokens),
      repeated: repeatedCalls(usage)
    }
  };
};
