/** The long tasks a page ran as it loaded, as `page check` says them: past a quarter of a second in all, else nothing. */

/** The busy time, in all, below which a page's long tasks are not said: the browser's own work, and nothing a visitor feels. */
const SAID_FROM_MS = 250;

export const busyOf = (kept: unknown): { tasks: number; longest: number; total: number } | undefined => {
  const lengths = Array.isArray(kept) ? kept.filter((each): each is number => typeof each === 'number') : [];
  const total = lengths.reduce((sum, each) => sum + each, 0);

  return total < SAID_FROM_MS ? undefined : { tasks: lengths.length, longest: Math.max(...lengths), total };
};
