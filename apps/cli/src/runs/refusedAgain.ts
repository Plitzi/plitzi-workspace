import type { Attention } from './view';

/** How long refusals of one task are counted together: a task refused this often in it is stuck, not unlucky. */
export const REFUSED_WINDOW_MS = 20 * 60_000;

/** How many refusals of one task within `REFUSED_WINDOW_MS` wake the lead. */
export const REFUSED_AGAIN = 3;

/**
 * A task refused again and again, said to the lead while it happens — not in the report after: a run's dev-1 was
 * refused four times in twenty minutes on t-heading (a file another task held, a wait run out, a complete from a wait)
 * and nobody knew until the run was over. Counted by the task the refusal was about — as the refusal says it, or the
 * token that ran it holds — its code and what it said.
 */
export const refusedAgain = (log: readonly Record<string, unknown>[], now: Date): Attention[] => {
  const since = now.getTime() - REFUSED_WINDOW_MS;
  const byTask = new Map<string, { by: string; codes: string[]; last: string }>();
  for (const entry of log) {
    const task = typeof entry.task === 'string' ? entry.task : undefined;
    if (
      entry.action !== 'refused' ||
      typeof entry.at !== 'string' ||
      Date.parse(entry.at) < since ||
      typeof entry.by !== 'string' ||
      task === undefined
    ) {
      continue;
    }

    const was = byTask.get(task);
    byTask.set(task, {
      by: entry.by,
      codes: [...(was?.codes ?? []), String(entry.code)],
      last: String(entry.message).split('\n')[0]
    });
  }

  return [...byTask]
    .filter(([, refused]) => refused.codes.length >= REFUSED_AGAIN)
    .map(([task, refused]) => ({
      kind: 'refused-again' as const,
      task,
      text: `${refused.by} was refused ${String(refused.codes.length)} times in ${String(REFUSED_WINDOW_MS / 60_000)} min on ${task} (${[...new Set(refused.codes)].join(', ')}) — stuck, not unlucky: the last said "${refused.last.slice(0, 160)}". Tell it the way (plitzi task message ${task} "…"), or decide`,
      who: 'lead' as const
    }));
};
