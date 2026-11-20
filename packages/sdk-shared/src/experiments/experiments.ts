import { isFlagName } from '../flags/schemaFlag';

import type { Element, Schema } from '../types';

/** The element that runs an experiment: a container drawing one of its variants. */
export const AB_TEST_TYPE = 'abTest';

/** Its parts, in order: the first is variant A (the control), the second B, and so on. */
export const AB_TEST_VARIANT_TYPE = 'abTestVariant';

/** Every variant an experiment may have, by its place among the test's variants: A first. */
export const EXPERIMENT_VARIANTS = ['a', 'b', 'c', 'd', 'e'] as const;

export type ExperimentVariant = (typeof EXPERIMENT_VARIANTS)[number];

/** The variant each experiment showed this visitor, by the experiment's name — what `{{ experiments.<name> }}` reads. */
export type ExperimentAssignments = Record<string, ExperimentVariant>;

/**
 * An experiment as the space declares it: each variant's weight, in order — its share of the visitors, against the
 * others' — and the variant the builder's canvas shows in its place.
 */
export type DeclaredExperiment = { weights: number[]; builderVariant: ExperimentVariant };

/**
 * An experiment's name: what `{{ experiments.<name> }}` reads, so — like a flag's — a valid key in a template path, and
 * what the visitor's cookie keeps their variant under.
 */
export const isExperimentName = (name: string): boolean => isFlagName(name);

export const isExperimentVariant = (value: unknown): value is ExperimentVariant =>
  EXPERIMENT_VARIANTS.some(variant => variant === value);

/** A variant's weight as an element may hold one: a whole number from 0 to 100. 0 shows it to nobody. */
export const isExperimentWeight = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;

/** A variant's weight when it says none: every variant left as it was gets the same share. */
export const DEFAULT_VARIANT_WEIGHT = 50;

/** The variant at a place among a test's variants: A at 0. */
export const variantAt = (index: number): ExperimentVariant | undefined => EXPERIMENT_VARIANTS[index];

/** A variant's place among a test's variants: 0 for A. */
export const indexOfVariant = (variant: ExperimentVariant): number => EXPERIMENT_VARIANTS.indexOf(variant);

/** A test's variants, in order, as many as there are letters for. */
export const variantsOf = (element: Element, flat: Schema['flat']): Element[] =>
  (element.definition.items ?? [])
    .filter(id => Object.hasOwn(flat, id) && flat[id].definition.type === AB_TEST_VARIANT_TYPE)
    .map(id => flat[id])
    .slice(0, EXPERIMENT_VARIANTS.length);

/** What an `abTest` element runs: its experiment's name and its variants' weights, or nothing for one not named yet. */
export const experimentOf = (
  element: Element,
  flat: Schema['flat']
): ({ name: string } & DeclaredExperiment) | undefined => {
  if (element.definition.type !== AB_TEST_TYPE) {
    return undefined;
  }

  const { experiment, builderVariant } = element.attributes;
  if (typeof experiment !== 'string' || !isExperimentName(experiment)) {
    return undefined;
  }

  const weights = variantsOf(element, flat).map(variant =>
    isExperimentWeight(variant.attributes.weight) ? variant.attributes.weight : DEFAULT_VARIANT_WEIGHT
  );
  const shown =
    isExperimentVariant(builderVariant) && indexOfVariant(builderVariant) < weights.length ? builderVariant : 'a';

  return { name: experiment, weights, builderVariant: shown };
};

/**
 * Every experiment a space runs, by name — on its pages and in its components. Two elements naming the same experiment
 * share it, so a visitor sees the same variant of both; the first one met gives the weights (the linter warns when
 * they disagree). One answer for the server assigning variants before it draws and the browser assigning those it was
 * not handed.
 */
export const declaredExperiments = (
  schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>
): Record<string, DeclaredExperiment> => {
  const declared: Record<string, DeclaredExperiment> = {};
  const trees = [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)];
  for (const flat of trees) {
    for (const element of Object.values(flat)) {
      const experiment = experimentOf(element, flat);
      if (experiment && !(experiment.name in declared)) {
        declared[experiment.name] = { weights: experiment.weights, builderVariant: experiment.builderVariant };
      }
    }
  }

  return declared;
};

/** The variants a visitor may still be shown: those with a weight above 0, each with its place. */
const liveVariants = (weights: number[]): { variant: ExperimentVariant; weight: number }[] =>
  weights.flatMap((weight, index) => {
    const variant = variantAt(index);

    return variant && weight > 0 ? [{ variant, weight }] : [];
  });

/** A variant drawn in proportion to the weights: `random` in [0, 1) walks their running total. */
const drawVariant = (
  live: { variant: ExperimentVariant; weight: number }[],
  random: () => number
): ExperimentVariant => {
  const total = live.reduce((sum, { weight }) => sum + weight, 0);
  let point = random() * total;
  for (const { variant, weight } of live) {
    if (point < weight) {
      return variant;
    }

    point -= weight;
  }

  return live[live.length - 1]?.variant ?? 'a';
};

export type ExperimentAssignment = {
  /** Every declared experiment's variant for this visitor. */
  assignments: ExperimentAssignments;
  /**
   * What the visitor keeps from now on: the variants drawn at random, the ones kept before among them. Nothing of an
   * experiment decided for everybody — one variant left with a weight — which needs nothing kept.
   */
  kept: ExperimentAssignments;
  /** The experiments drawn for this visitor just now — a page drawn with any is theirs alone, and they keep them. */
  drawn: string[];
};

/**
 * The variant of each experiment for one visitor. The one they kept, while it still has a weight — what they were
 * shown is what their visit is measured on, so a change of weights does not move them; a new one drawn in proportion to
 * the weights when they have none, or theirs was taken out (weight 0). An experiment with one variant left with a
 * weight is ended: everybody sees that one (A when none has any).
 */
export const assignExperiments = (
  declared: Record<string, DeclaredExperiment>,
  kept: ExperimentAssignments,
  random: () => number = Math.random
): ExperimentAssignment => {
  const assignments: ExperimentAssignments = {};
  const keep: ExperimentAssignments = {};
  const drawn: string[] = [];
  for (const [name, { weights }] of Object.entries(declared)) {
    const live = liveVariants(weights);
    if (live.length <= 1) {
      assignments[name] = live[0]?.variant ?? 'a';
      continue;
    }

    const previous = Object.hasOwn(kept, name) ? kept[name] : undefined;
    const stays = live.some(({ variant }) => variant === previous) ? previous : undefined;
    const variant = stays ?? drawVariant(live, random);
    if (stays === undefined) {
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
