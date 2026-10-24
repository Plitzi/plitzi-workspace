import { logRun, readRunLog } from './run';
import { readUsage } from './usage';

import type { LoadedRun, RunContext } from './run';

/**
 * What each agent's harness spent, kept in the run's log as each piece of its work ends — a task completed, a review
 * decided (`spent`): the window since its last, so nothing is counted twice and nothing between two pieces is lost.
 * The monitor's spend panel reads it as the run goes. A round's report keeps its own, in detail; this is every agent's,
 * the lead and the reviewers among them — encore-2's tester read 30M tokens, nearly all of it reviewing, which no
 * round's report held.
 */

/** What a piece of work is: a task's round, or a review's verdict. */
export type Piece = 'task' | 'review';

export interface Spent {
  agent: string;
  /** The pieces of work it ended. */
  pieces: number;
  /** The model's answers. */
  turns: number;
  /** Every turn's whole context, summed: what it read. */
  read: number;
  /** Its context when it last ended a piece. */
  context: number;
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
    read: spent.processed,
    context: spent.contextAtEnd,
    ...(spent.model ? { model: spent.model } : {})
  });
};

/** Each agent's spend so far, read off the run's log: the most read first. */
export const spentOf = (log: readonly Record<string, unknown>[]): Spent[] => {
  const by = new Map<string, Spent>();
  for (const entry of log) {
    if (entry.action !== 'spent' || typeof entry.by !== 'string') {
      continue;
    }

    const kept = by.get(entry.by) ?? { agent: entry.by, pieces: 0, turns: 0, read: 0, context: 0 };
    kept.pieces += 1;
    kept.turns += count(entry.turns);
    kept.read += count(entry.read);
    kept.context = count(entry.context);
    if (typeof entry.model === 'string') {
      kept.model = entry.model;
    }

    by.set(entry.by, kept);
  }

  return [...by.values()].sort((a, b) => b.read - a.read || a.agent.localeCompare(b.agent));
};
