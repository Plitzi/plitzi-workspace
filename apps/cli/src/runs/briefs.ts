/**
 * What the agents' briefs weighed (`task context`), part by part: an agent reads its brief again on every turn after,
 * and encore-2's report could say only that it was read again for 1.1M tokens — not which part was heavy.
 */

export interface Briefs {
  calls: number;
  /** The median brief, in characters. */
  median: number;
  /** Characters by part over every call: the primer, the task's own, the files (`--files`), data shapes, imports. */
  byPart: Record<string, number>;
}

const partsOf = (entry: Record<string, unknown>): Record<string, number> | undefined => {
  const { parts } = entry;
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(parts).flatMap(([part, size]) => (typeof size === 'number' ? [[part, size] as const] : []))
  );
};

/** Every brief the run's log kept, summed: none when no agent read one this way. */
export const briefsOf = (log: readonly Record<string, unknown>[]): Briefs | undefined => {
  const read = log.flatMap(entry => (entry.action === 'brief' ? [partsOf(entry)] : [])).filter(each => !!each);
  if (read.length === 0) {
    return undefined;
  }

  const totals = read.map(parts => Object.values(parts).reduce((sum, size) => sum + size, 0)).sort((a, b) => a - b);
  const byPart: Record<string, number> = {};
  for (const parts of read) {
    for (const [part, size] of Object.entries(parts)) {
      byPart[part] = (byPart[part] ?? 0) + size;
    }
  }

  return { calls: read.length, median: totals[Math.floor(totals.length / 2)], byPart };
};

/** The briefs in a line: how many, the median, and each part's share. */
export const briefsText = (briefs: Briefs | undefined): string[] => {
  if (!briefs) {
    return [];
  }

  const all = Object.values(briefs.byPart).reduce((sum, size) => sum + size, 0) || 1;
  const shares = Object.entries(briefs.byPart)
    .filter(([, size]) => size > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([part, size]) => `${part} ${String(Math.round((size / all) * 100))}%`);

  return [
    `- Briefs (task context): ${String(briefs.calls)}, the median ${String(briefs.median)} characters — ${shares.join(', ')}`
  ];
};
