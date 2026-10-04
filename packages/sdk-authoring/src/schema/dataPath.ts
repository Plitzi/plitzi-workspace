/**
 * Following a binding's path into a value — a provider's answer, a sample of it — the one way the linter (against a
 * sample of the answer) and a page check (against the answer itself) both do it, so the two say the same thing.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A path as its steps: `apiContainer_site.data.rows[2].title` is `apiContainer_site`, `data`, `rows`, `2`, `title`. */
export const pathSteps = (path: string): string[] => path.split(/[.[\]]/).filter(step => step !== '');

export type PathReach =
  | { found: true; value: unknown }
  /** How far it got (`at`, the steps it did take), and what there was to choose from where it stopped. */
  | { found: false; at: string[]; keys: string[] };

/** Where a path leads in a value — or how far it got, and what was there to choose from where it stopped. */
export const followPath = (value: unknown, steps: readonly string[]): PathReach => {
  let current = value;
  for (const [index, step] of steps.entries()) {
    const next: unknown = Array.isArray(current)
      ? current[Number(step)]
      : isRecord(current)
        ? current[step]
        : undefined;
    if (next === undefined) {
      const keys = isRecord(current)
        ? Object.keys(current)
        : Array.isArray(current)
          ? [`0…${String(current.length - 1)}`]
          : [];

      return { found: false, at: steps.slice(0, index), keys };
    }

    current = next;
  }

  return { found: true, value: current };
};

/**
 * Whether a path that did not reach is a wrong path rather than a quiet field: a missing LAST step may be a field some
 * answers do not carry — a badge, an avatar — and a binding onto it is written for that; one that stops before it read
 * a branch the answer never had. A list's rows are never optional: a list reading nothing draws nothing.
 */
export const isWrongPath = (reach: PathReach, pathLength: number, rows: boolean): boolean =>
  !reach.found && (rows || reach.at.length < pathLength - 1);

/** Where a path stopped, and what was there: `apiContainer_landing.data has plans, compare, faq`. */
export const stoppedAt = (root: string, reach: Extract<PathReach, { found: false }>): string => {
  const where = [root, ...reach.at].join('.');

  return reach.keys.length > 0 ? `${where} has ${reach.keys.slice(0, 12).join(', ')}` : `${where} is not an object`;
};
