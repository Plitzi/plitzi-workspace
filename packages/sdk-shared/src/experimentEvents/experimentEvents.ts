/**
 * The analytics events an A/B test is measured with — apart from `experiments`, which a page server loads at every boot
 * and which never reports one.
 */
import { isExperimentName, isExperimentVariant } from '../experiments/experiments';

import type { ExperimentAssignments, ExperimentVariant } from '../experiments/experiments';

/**
 * The analytics event a visitor's variant is reported with, once — when it is drawn for them: one visitor of that
 * variant. Reserved (`$`): a space's own `plitzi.track` names never start with it.
 */
export const EXPERIMENT_EXPOSURE_EVENT = '$experiment';

/** The analytics event a goal is reached with (the `reachGoal` step), carrying the visitor's variants. */
export const GOAL_EVENT = '$goal';

/** What a goal's event names each of the visitor's variants by: `ab.heroTest: 'b'`. */
const VARIANT_PROP = 'ab.';

/** A goal's name as a step writes it and the console shows it: what a conversion is counted under. */
export const isGoalName = (name: unknown): name is string =>
  typeof name === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(name);

export const exposureProps = (experiment: string, variant: ExperimentVariant): Record<string, string> => ({
  experiment,
  variant
});

export const goalProps = (goal: string, assignments: ExperimentAssignments): Record<string, string> => ({
  goal,
  ...Object.fromEntries(Object.entries(assignments).map(([name, variant]) => [`${VARIANT_PROP}${name}`, variant]))
});

type EventProps = Readonly<Record<string, string | number | boolean>> | undefined;

/** What an exposure event says — the experiment and the variant shown — or nothing it can read. */
export const exposureOf = (props: EventProps): { experiment: string; variant: ExperimentVariant } | undefined => {
  const experiment = props?.experiment;
  const variant = props?.variant;

  return typeof experiment === 'string' && isExperimentName(experiment) && isExperimentVariant(variant)
    ? { experiment, variant }
    : undefined;
};

/** What a goal event says: the goal, and the visitor's variant of each experiment they were in when they reached it. */
export const goalOf = (props: EventProps): { goal: string; assignments: ExperimentAssignments } | undefined => {
  const goal = props?.goal;
  if (!isGoalName(goal)) {
    return undefined;
  }

  const assignments: ExperimentAssignments = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    const name = key.slice(VARIANT_PROP.length);
    if (key.startsWith(VARIANT_PROP) && isExperimentName(name) && isExperimentVariant(value)) {
      assignments[name] = value;
    }
  }

  return { goal, assignments };
};
