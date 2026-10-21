import type { RunTask } from './model';

/** A priority as a number to sort by: the lower, the sooner. */
export const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** The longest chain of estimates that starts at each task: what is left of the critical path from it. */
export const chainMinutes = (tasks: readonly RunTask[]): Map<string, number> => {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const dependants = new Map<string, string[]>();
  tasks.forEach(task =>
    task.dependsOn.forEach(dependency => dependants.set(dependency, [...(dependants.get(dependency) ?? []), task.id]))
  );
  const memo = new Map<string, number>();
  const chain = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) {
      return known;
    }

    const own = byId.get(id)?.estimateMinutes ?? 0;
    const after = Math.max(0, ...(dependants.get(id) ?? []).map(chain));
    memo.set(id, own + after);

    return own + after;
  };
  tasks.forEach(task => chain(task.id));

  return memo;
};

/**
 * Each task's priority as every queue weighs it: its own, or that of any task waiting on it, whichever comes first — a
 * low task that a critical one waits for is critical, and one that holds three back goes before one that holds none
 * (velada-now: the three reviews t-motion waited for came in the order they arrived, as any other).
 */
export const effectiveRanks = (tasks: readonly RunTask[]): Map<string, number> => {
  const dependants = new Map<string, string[]>();
  tasks.forEach(task =>
    task.dependsOn.forEach(dependency => dependants.set(dependency, [...(dependants.get(dependency) ?? []), task.id]))
  );
  const own = new Map(tasks.map(task => [task.id, PRIORITY_RANK[task.priority]] as const));
  const memo = new Map<string, number>();
  const rank = (id: string, seen: ReadonlySet<string>): number => {
    const known = memo.get(id);
    if (known !== undefined) {
      return known;
    }

    const next = new Set([...seen, id]);
    const best = Math.min(
      own.get(id) ?? PRIORITY_RANK.low,
      ...(dependants.get(id) ?? []).filter(each => !seen.has(each)).map(each => rank(each, next))
    );
    memo.set(id, best);

    return best;
  };
  tasks.forEach(task => rank(task.id, new Set()));

  return memo;
};

/** The order every queue takes tasks in — to work, to review, to hand a file to: the most urgent, then what it unlocks. */
export const byUrgency = (tasks: readonly RunTask[]): ((a: RunTask, b: RunTask) => number) => {
  const ranks = effectiveRanks(tasks);
  const chains = chainMinutes(tasks);

  return (a, b) =>
    (ranks.get(a.id) ?? PRIORITY_RANK.low) - (ranks.get(b.id) ?? PRIORITY_RANK.low) ||
    (chains.get(b.id) ?? 0) - (chains.get(a.id) ?? 0);
};
