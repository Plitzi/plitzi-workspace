/** A finding the lead settled, as the log keeps it: what it was about, and what the lead did (`run settle`). */
export const SETTLED = 'finding-settled';

/** The subjects of the findings the lead settled, read off the run's log. */
export const settledFindings = (log: readonly Record<string, unknown>[]): Set<string> =>
  new Set(log.flatMap(entry => (entry.action === SETTLED && typeof entry.subject === 'string' ? [entry.subject] : [])));
