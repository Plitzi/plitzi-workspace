import type { JobSpaces } from '../../types';

/**
 * Which spaces a worker's claim takes, by their share of it (`perSpace`, `room().fullSpaces`): first those not at their
 * share — every space's work gets its share before any gets more — then, in the slots nothing else waits for, those that
 * are.
 */

/** `spaces` without those at their ceiling: what a claim takes, so no job is claimed only to be handed back refused. */
export const withoutFull = (spaces: JobSpaces | undefined, full: number[]): JobSpaces | undefined => {
  if (full.length === 0) {
    return spaces;
  }

  if (!spaces) {
    return { except: full };
  }

  return 'only' in spaces
    ? { only: spaces.only.filter(spaceId => !full.includes(spaceId)) }
    : { except: [...new Set([...spaces.except, ...full])] };
};

/** Of the spaces this worker takes, those already at their share (`full`): where its spare slots go. None, none. */
export const onlyFull = (spaces: JobSpaces | undefined, full: number[]): JobSpaces | undefined => {
  const only = !spaces
    ? full
    : 'only' in spaces
      ? spaces.only.filter(spaceId => full.includes(spaceId))
      : full.filter(spaceId => !spaces.except.includes(spaceId));

  return only.length > 0 ? { only } : undefined;
};
