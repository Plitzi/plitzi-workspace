import type { Attention } from '../view/view';

/** An acceptance line nothing could answer on a task's copy, as the run's log keeps it. */
interface Unanswered {
  task: string;
  said: string;
  check: string;
  why: string;
}

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * The lines nothing could answer that still stand, by task and check: logged as each is met, gone once their task's
 * acceptance is amended. A line nothing can answer is the lead's to amend — every try of the task fails on it — and
 * was a note to it, matched against what was said by its words: a run's dev-1 waited on two such lines.
 */
export const openUnanswered = (log: readonly Record<string, unknown>[]): Map<string, Unanswered> => {
  const open = new Map<string, Unanswered>();
  for (const entry of log) {
    const task = text(entry.task);
    const check = text(entry.check);
    if (entry.action === 'line-unanswered' && task !== undefined && check !== undefined) {
      open.set(`${task}\u0000${check}`, { task, check, said: text(entry.said) ?? check, why: text(entry.why) ?? '' });
    }

    if (entry.action === 'amend' && Array.isArray(entry.tasks)) {
      for (const amended of entry.tasks as unknown[]) {
        const id = typeof amended === 'object' && amended !== null && 'task' in amended ? amended.task : undefined;
        for (const key of [...open.keys()].filter(each => each.startsWith(`${String(id)}\u0000`))) {
          open.delete(key);
        }
      }
    }
  }

  return open;
};

/**
 * What the lead is woken for: each line nothing answers, with the way out — its task approved or not, as the finish runs
 * every line again on the whole result.
 */
export const unansweredLines = (log: readonly Record<string, unknown>[]): Attention[] =>
  [...openUnanswered(log).values()].map(line => ({
    kind: 'line-unanswered' as const,
    task: line.task,
    subject: line.check,
    text: `${line.task}'s acceptance line "${line.said}" cannot be answered — ${line.check} — ${line.why || 'it read nothing'}. Not the work's: amend the line (plitzi run amend), or say why it waits`,
    who: 'lead' as const
  }));
