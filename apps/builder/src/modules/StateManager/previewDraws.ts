import { assignExperiments } from '@plitzi/sdk-shared/experiments';

import type { DeclaredExperiment, ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

/**
 * The variants the preview shows once the tests it draws are drawn again, as for a new visitor: each of `drawn` the
 * space still runs drawn by its shares, the variants picked by hand for the others kept as they were.
 */
export const drawnAgain = (
  declared: Record<string, DeclaredExperiment>,
  drawn: readonly string[],
  shown: ExperimentAssignments,
  random: () => number = Math.random
): ExperimentAssignments => {
  const running = Object.fromEntries(
    drawn.filter(name => Object.hasOwn(declared, name)).map(name => [name, declared[name]])
  );

  return { ...shown, ...assignExperiments(running, {}, random).assignments };
};
