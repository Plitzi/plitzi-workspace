import type { PlannedTask } from '../core/model';

/**
 * One section's dress proved by two tasks: what one task's look needs is drawn in the other's files, and one waits for
 * the other through its review — a run's t-heading, whose glow was the sponsors section's, waited fifty minutes
 * on t-sponsors. Said at `run open --dry-run`, never refused: two tasks may dress one section on purpose, in turn.
 */
export const sharedLookNotices = (tasks: readonly PlannedTask[]): string[] => {
  const bySection = new Map<string, Set<string>>();
  for (const task of tasks) {
    for (const line of task.acceptance) {
      const check = typeof line === 'string' ? undefined : line.check;
      const shot = check === undefined ? undefined : /plitzi page shot\s+(\S+)[^;&|]*--dress/.exec(check);
      const clip = check === undefined ? undefined : /--within\s+(\S+)/.exec(check)?.[1];
      if (!shot || clip === undefined) {
        continue;
      }

      const section = `${shot[1]} #${clip}`;
      bySection.set(section, new Set([...(bySection.get(section) ?? []), task.id]));
    }
  }

  return [...bySection]
    .filter(([, ids]) => ids.size > 1)
    .map(
      ([section, ids]) =>
        `${[...ids].join(' and ')} both prove the dress of ${section}: one look split across two tasks waits on the other's files through its review — give it to one, or make one follow the other (dependsOn)`
    );
};
