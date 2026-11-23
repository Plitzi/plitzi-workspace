import { assignExperiments } from '@plitzi/sdk-shared/experiments';

import type { DeclaredExperiment, ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

/**
 * The variants the preview shows: each test the space runs and nobody picked by hand drawn by its shares — the ones
 * with no variant yet, or every one of them for a new visitor (`fresh`) — and the variants picked kept as they are.
 * What it shows of tests the space no longer runs is left out.
 */
export const withDraws = (
  declared: Record<string, DeclaredExperiment>,
  shown: ExperimentAssignments,
  picked: readonly string[],
  { fresh = false, random = Math.random }: { fresh?: boolean; random?: () => number } = {}
): ExperimentAssignments => {
  const running = Object.keys(declared);
  const kept = Object.fromEntries(
    Object.entries(shown).filter(([name]) => running.includes(name) && (picked.includes(name) || !fresh))
  );
  const toDraw = Object.fromEntries(
    running.filter(name => !picked.includes(name) && !Object.hasOwn(kept, name)).map(name => [name, declared[name]])
  );

  return { ...kept, ...assignExperiments(toDraw, {}, random).assignments };
};

/** Whether two sets of variants show the same: what spares the store a write that changes nothing. */
export const sameVariants = (a: ExperimentAssignments, b: ExperimentAssignments): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([name, variant]) => b[name] === variant);
