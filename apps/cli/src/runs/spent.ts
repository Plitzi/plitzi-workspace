import { isRecord } from '@plitzi/sdk-shared/helpers';

import { logRun, readRunLog } from './run';
import { readUsage } from './usage';

import type { LoadedRun, RunContext } from './run';
import type { UsageLine } from './usage';

/**
 * What each agent's harness spent, kept in the run's log as each piece of its work ends — a task completed, a review
 * decided (`spent`): the window since its last, so nothing is counted twice and nothing between two pieces is lost.
 * The monitor's spend panel reads it as the run goes. A round's report keeps its own, in detail; this is every agent's,
 * the lead and the reviewers among them — a run's tester read 30M tokens, nearly all of it reviewing, which no
 * round's report held.
 */

/** What a piece of work is: a task's round, or a review's verdict. */
export type Piece = 'task' | 'review';

export interface Spent {
  agent: string;
  /** The pieces of work it ended. */
  pieces: number;
  /** The tasks those pieces were of — its own and those it reviewed — each once: what an average a task is taken over. */
  tasks: string[];
  /**
   * Its sessions: each start of its harness, read off the sessions its commands ran in — one a task for an agent of
   * `"session": "task"`, several pieces each for `context`: what an average a session is taken over.
   */
  sessions: number;
  /** The model's answers. */
  turns: number;
  /**
   * What it took in new — fresh input, and context written to the cache. With `output`, what costs; kept apart from
   * `cached`: a run's test-1 read 1.1M tokens for one spec, 92 % of them its context read again from the cache.
   */
  input: number;
  /** What it wrote: the model's answers. */
  output: number;
  /** Its context read again from the cache, every turn: a tenth of a fresh token's price, and most of what is read. */
  cached: number;
  /** Its context when it last ended a piece. */
  context: number;
  /** What it cost at the API's prices; none when a piece's model has no price (`harness/prices.ts`). */
  cost?: number;
  model?: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Keeps what the caller's harness spent since it last ended a piece; nothing when its harness is not read. */
export const logSpent = async (ctx: RunContext, loaded: LoadedRun, task: string, piece: Piece): Promise<void> => {
  if (ctx.spent === undefined) {
    return;
  }

  const log = await readRunLog(loaded.paths);
  const from =
    text(log.findLast(entry => entry.action === 'spent' && entry.by === ctx.agent)?.at) || loaded.record.openedAt;
  const usage = readUsage(loaded.paths.dir).filter(line => line.by === ctx.agent && line.at >= from);
  // A session that cannot be read is no spend to keep, and never stops the work that ended.
  const spent = await ctx
    .spent({
      from,
      to: ctx.now().toISOString(),
      sessions: [...new Set(usage.flatMap(line => (line.session ? [line.session] : [])))],
      processes: [...new Set(usage.flatMap(line => (line.process ? [line.process] : [])))]
    })
    .catch(() => undefined);
  if (spent === undefined) {
    return;
  }

  await logRun(ctx, loaded.paths, {
    action: 'spent',
    task,
    piece,
    turns: spent.turns,
    input: spent.input + spent.cacheWrite,
    output: spent.output,
    cached: spent.cacheRead,
    context: spent.contextAtEnd,
    ...(spent.cost === undefined ? {} : { cost: spent.cost }),
    minutes: spent.minutes,
    ...(spent.model ? { model: spent.model } : {})
  });
};

/**
 * Each agent's spend so far, read off the run's log — its sessions off what its commands ran in (`usage.jsonl`): the
 * most spent first, what is new, then what was read again.
 */
export const spentOf = (log: readonly Record<string, unknown>[], usage: readonly UsageLine[] = []): Spent[] => {
  const sessionsOf = (agent: string): number =>
    Math.max(1, new Set(usage.flatMap(line => (line.by === agent && line.session ? [line.session] : []))).size);
  const by = new Map<string, Spent>();
  for (const entry of log) {
    if (entry.action !== 'spent' || typeof entry.by !== 'string') {
      continue;
    }

    const kept = by.get(entry.by) ?? {
      agent: entry.by,
      pieces: 0,
      tasks: [],
      sessions: sessionsOf(entry.by),
      turns: 0,
      input: 0,
      output: 0,
      cached: 0,
      context: 0,
      cost: 0
    };
    kept.pieces += 1;
    if (typeof entry.task === 'string' && !kept.tasks.includes(entry.task)) {
      kept.tasks.push(entry.task);
    }
    kept.turns += count(entry.turns);
    kept.input += count(entry.input);
    kept.output += count(entry.output);
    kept.cached += count(entry.cached);
    kept.context = count(entry.context);
    // One piece with no price leaves the agent with none: a sum of some pieces is no cost of its work.
    kept.cost =
      kept.cost === undefined || typeof entry.cost !== 'number' || !Number.isFinite(entry.cost)
        ? undefined
        : kept.cost + entry.cost;
    if (typeof entry.model === 'string') {
      kept.model = entry.model;
    }

    by.set(entry.by, kept);
  }

  return [...by.values()].sort(
    (a, b) => b.input + b.output - (a.input + a.output) || b.cached - a.cached || a.agent.localeCompare(b.agent)
  );
};

/** How far back the monitor's spend chart reaches, in minutes. */
export const SPEND_MINUTES = 30;

/**
 * The run's tokens in each of the last `span` minutes up to `now`, the oldest first — each piece's minutes as its
 * harness answered in them, kept as the piece ended: the minutes of a piece still at work come when it ends.
 */
export const spentPerMinute = (log: readonly Record<string, unknown>[], now: Date, span: number): number[] => {
  const minutes = new Array<number>(span).fill(0);
  const last = Math.floor(now.getTime() / 60_000);
  for (const entry of log) {
    if (entry.action !== 'spent' || !Array.isArray(entry.minutes)) {
      continue;
    }

    for (const minute of entry.minutes) {
      if (!isRecord(minute) || typeof minute.at !== 'string') {
        continue;
      }

      const index = span - 1 - (last - Math.floor(Date.parse(`${minute.at}Z`) / 60_000));
      if (index >= 0 && index < span) {
        minutes[index] = (minutes[index] ?? 0) + count(minute.tokens);
      }
    }
  }

  return minutes;
};

/** Dollars in a few characters: $0.42, $12.4, $130 — under a cent, said as such. */
export const costShort = (usd: number): string =>
  usd < 0.01
    ? '<$0.01'
    : usd < 10
      ? `$${usd.toFixed(2)}`
      : usd < 100
        ? `$${usd.toFixed(1)}`
        : `$${String(Math.round(usd))}`;

/** What the run's agents cost in all at the API's prices — none when one of them spent on a model with no price. */
export const costInAll = (spend: readonly Spent[]): number | undefined =>
  spend.length === 0 || spend.some(each => each.cost === undefined)
    ? undefined
    : spend.reduce((total, each) => total + (each.cost ?? 0), 0);

/** How much of every token counted was the context read again from the cache, in whole percent. */
export const cachedShare = (spend: readonly Spent[]): number => {
  const total = spend.reduce((all, each) => all + each.input + each.output + each.cached, 0);

  return total === 0 ? 0 : Math.round((spend.reduce((all, each) => all + each.cached, 0) / total) * 100);
};

/** One piece of an agent's work and what it cost: a task's round, or a review's verdict. */
export interface PieceCost {
  agent: string;
  task: string;
  piece: Piece;
  turns: number;
  cost: number;
}

/**
 * The pieces that cost the most, the costliest first — what a total by agent hides: a run's one designer task was $2.72
 * of $6.75, and the lead's first review of one task $1.06.
 */
export const costliestPieces = (log: readonly Record<string, unknown>[], limit: number): PieceCost[] =>
  log
    .flatMap(entry =>
      entry.action === 'spent' &&
      typeof entry.by === 'string' &&
      typeof entry.task === 'string' &&
      (entry.piece === 'task' || entry.piece === 'review') &&
      typeof entry.cost === 'number' &&
      Number.isFinite(entry.cost)
        ? [
            {
              agent: entry.by,
              task: entry.task,
              piece: entry.piece === 'task' ? ('task' as const) : ('review' as const),
              turns: count(entry.turns),
              cost: entry.cost
            }
          ]
        : []
    )
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
