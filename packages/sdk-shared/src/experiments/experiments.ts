import { isFlagName } from '../flags/schemaFlag';
import { isRecord } from '../helpers/isRecord';

import type { Element, Schema } from '../types';

/** The element that runs an experiment: a container drawing one of its two variants. */
export const AB_TEST_TYPE = 'abTest';

/** Its parts, in order: the first is variant A (the control), the second variant B. */
export const AB_TEST_VARIANT_TYPE = 'abTestVariant';

export type ExperimentVariant = 'a' | 'b';

export const EXPERIMENT_VARIANTS: readonly ExperimentVariant[] = ['a', 'b'];

/** The variant each experiment showed this visitor, by the experiment's name — what `{{ experiments.<name> }}` reads. */
export type ExperimentAssignments = Record<string, ExperimentVariant>;

/**
 * An experiment as the space declares it: the share of visitors, 0–100, who see variant B, and the variant the builder's
 * canvas shows in its place.
 */
export type DeclaredExperiment = { split: number; builderVariant: ExperimentVariant };

/**
 * An experiment's name: what `{{ experiments.<name> }}` reads, so — like a flag's — a valid key in a template path, and
 * what the visitor's cookie keeps their variant under.
 */
export const isExperimentName = (name: string): boolean => isFlagName(name);

export const isExperimentVariant = (value: unknown): value is ExperimentVariant => value === 'a' || value === 'b';

/** A share of visitors as an element may hold one: a whole number from 0 to 100. */
export const isExperimentSplit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;

/** The share of visitors who see B when an element says none. */
export const DEFAULT_EXPERIMENT_SPLIT = 50;

/** What an `abTest` element runs: its experiment's name and split, or nothing for one not named yet. */
export const experimentOf = (element: Element): ({ name: string } & DeclaredExperiment) | undefined => {
  if (element.definition.type !== AB_TEST_TYPE) {
    return undefined;
  }

  const { experiment, split, builderVariant } = element.attributes;
  if (typeof experiment !== 'string' || !isExperimentName(experiment)) {
    return undefined;
  }

  return {
    name: experiment,
    split: isExperimentSplit(split) ? split : DEFAULT_EXPERIMENT_SPLIT,
    builderVariant: isExperimentVariant(builderVariant) ? builderVariant : 'a'
  };
};

/**
 * Every experiment a space runs, by name — on its pages and in its components. Two elements naming the same experiment
 * share it, so a visitor sees both on the same side; the first one met gives the split (the linter warns when they
 * disagree). One answer for the server assigning variants before it draws and the browser assigning those it was not
 * handed.
 */
export const declaredExperiments = (
  schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>
): Record<string, DeclaredExperiment> => {
  const declared: Record<string, DeclaredExperiment> = {};
  const trees = [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)];
  for (const flat of trees) {
    for (const element of Object.values(flat)) {
      const experiment = experimentOf(element);
      if (experiment && !(experiment.name in declared)) {
        declared[experiment.name] = { split: experiment.split, builderVariant: experiment.builderVariant };
      }
    }
  }

  return declared;
};

/**
 * The variant of an experiment decided for everybody: at 0 every visitor sees A, at 100 every one sees B — the split an
 * experiment is ended with, whatever a visitor was shown before.
 */
const decidedVariant = (split: number): ExperimentVariant | undefined => {
  if (split <= 0) {
    return 'a';
  }

  if (split >= 100) {
    return 'b';
  }

  return undefined;
};

export type ExperimentAssignment = {
  /** Every declared experiment's variant for this visitor. */
  assignments: ExperimentAssignments;
  /**
   * What the visitor keeps from now on: the variants drawn at random, the ones kept before among them. Empty for an
   * experiment decided for everybody (0 or 100), which needs nothing kept.
   */
  kept: ExperimentAssignments;
  /** The experiments drawn for this visitor just now — a page drawn with any is theirs alone, and they keep them. */
  drawn: string[];
};

/**
 * The variant of each experiment for one visitor: the one they kept, while the experiment still splits its visitors; a
 * new one drawn for an experiment they have none of (`random` below `split` / 100 sees B). A visitor keeps a variant
 * when the split changes — what they were shown is what their visit is measured on — until the experiment is ended
 * at 0 or 100.
 */
export const assignExperiments = (
  declared: Record<string, DeclaredExperiment>,
  kept: ExperimentAssignments,
  random: () => number = Math.random
): ExperimentAssignment => {
  const assignments: ExperimentAssignments = {};
  const keep: ExperimentAssignments = {};
  const drawn: string[] = [];
  for (const [name, { split }] of Object.entries(declared)) {
    const decided = decidedVariant(split);
    if (decided) {
      assignments[name] = decided;
      continue;
    }

    const previous = Object.hasOwn(kept, name) ? kept[name] : undefined;
    const variant = previous ?? (random() * 100 < split ? 'b' : 'a');
    if (!previous) {
      drawn.push(name);
    }

    assignments[name] = variant;
    keep[name] = variant;
  }

  return { assignments, kept: keep, drawn };
};

/** What the builder's canvas shows of each experiment: the variant its settings name, never a visitor's. */
export const builderExperiments = (declared: Record<string, DeclaredExperiment>): ExperimentAssignments =>
  Object.fromEntries(Object.entries(declared).map(([name, { builderVariant }]) => [name, builderVariant]));

/** What a payload or a prop says of the assignments, kept only where it is a name and a variant. */
export const experimentAssignmentsOf = (value: unknown): ExperimentAssignments =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, ExperimentVariant] => isExperimentName(entry[0]) && isExperimentVariant(entry[1])
        )
      )
    : {};
