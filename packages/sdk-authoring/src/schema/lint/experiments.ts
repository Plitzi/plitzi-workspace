import {
  AB_TEST_TYPE,
  AB_TEST_VARIANT_TYPE,
  DEFAULT_VARIANT_WEIGHT,
  EXPERIMENT_VARIANTS,
  indexOfVariant,
  isExperimentName,
  isExperimentVariant,
  isExperimentWeight
} from '@plitzi/sdk-shared/experiments';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** Every element of the space, in the pages' tree and in every component's, each with the tree it is in. */
const allElements = (schema: Schema): { element: Element; flat: Schema['flat'] }[] => [
  ...Object.values(schema.flat).map(element => ({ element, flat: schema.flat })),
  ...Object.values(schema.components).flatMap(component =>
    Object.values(component.flat).map(element => ({ element, flat: component.flat }))
  )
];

/** An experiment no `abTest` runs, read from a template: it reads as nothing, so what it decides is never `'b'`. */
export const reportUnknownExperiment = (ctx: LintContext, name: string, where: string, id?: string): void => {
  ctx.error(
    'experiment-unknown',
    `${where} reads "experiments.${name}", which no A/B test runs${didYouMean(name, ctx.experiments) || '.'} An \`abTest\` with \`experiment: '${name}'\` runs it.`,
    id
  );
};

/** Its name, held to what a template can read and a cookie keep. */
const lintName = (ctx: LintContext, element: Element, experiment: unknown): string | undefined => {
  if (experiment === undefined || experiment === '') {
    ctx.warn(
      'experiment-unnamed',
      `A/B test "${element.id}" has no \`experiment\`, so it runs nothing: every visitor sees variant A. Name it — \`experiment: 'heroTest'\` — to split its visitors.`,
      element.id
    );

    return undefined;
  }

  if (typeof experiment !== 'string' || !isExperimentName(experiment)) {
    const shown = typeof experiment === 'string' ? experiment : JSON.stringify(experiment);
    ctx.error(
      'experiment-name',
      `A/B test "${element.id}" names its experiment ${JSON.stringify(experiment)}, which a template cannot read as \`experiments.x\`. Use letters, digits and "_", starting with a letter or "_": "${shown.replace(/[^A-Za-z0-9_]/g, '_')}".`,
      element.id
    );

    return undefined;
  }

  return experiment;
};

/** Its variants, A first: two to five, and nothing else — what is not a variant is never shown. */
const lintVariants = (ctx: LintContext, element: Element, flat: Schema['flat']): Element[] => {
  const items = element.definition.items ?? [];
  const variants = items.filter(id => Object.hasOwn(flat, id) && flat[id].definition.type === AB_TEST_VARIANT_TYPE);
  const others = items.filter(id => !variants.includes(id));
  if (variants.length < 2 || variants.length > EXPERIMENT_VARIANTS.length || others.length > 0) {
    ctx.error(
      'experiment-variants',
      `A/B test "${element.id}" holds ${variants.length} abTestVariant${variants.length === 1 ? '' : 's'}${others.length > 0 ? ` and ${others.length} other element${others.length === 1 ? '' : 's'} (${others.join(', ')})` : ''}. It holds two to ${EXPERIMENT_VARIANTS.length} — the first is A, the second B… — and only the variant a visitor is drawn is shown, so anything else is never seen. Write \`abTest({ experiment, children: [abTestVariant([…]), abTestVariant([…])] })\`.`,
      element.id
    );
  }

  return variants.slice(0, EXPERIMENT_VARIANTS.length).map(id => flat[id]);
};

/** Each variant's weight a share, and at least one shown: all at 0 shows everybody A, whatever it says. */
const lintWeights = (ctx: LintContext, element: Element, variants: Element[]): number[] | undefined => {
  const weights = variants.map(variant => variant.attributes.weight ?? DEFAULT_VARIANT_WEIGHT);
  const unread = variants.filter((_, index) => !isExperimentWeight(weights[index]));
  for (const variant of unread) {
    ctx.error(
      'experiment-weight',
      `Variant "${variant.id}" of A/B test "${element.id}" has \`weight: ${JSON.stringify(variant.attributes.weight)}\`. It is the variant's share of the visitors against the others': a whole number from 0 to 100 — two at 50 split them in half. 0 shows it to nobody.`,
      variant.id
    );
  }

  if (unread.length > 0 || !weights.every(isExperimentWeight)) {
    return undefined;
  }

  if (weights.length > 0 && weights.every(weight => weight === 0)) {
    ctx.error(
      'experiment-weight',
      `Every variant of A/B test "${element.id}" weighs 0, so none is shown by its weight and everybody sees A. Give the variants to show a weight above 0 — one alone ends the experiment, everybody sees it.`,
      element.id
    );
  }

  return weights;
};

/** The variant the builder's canvas shows, one the test has. */
const lintBuilderVariant = (ctx: LintContext, element: Element, count: number): void => {
  const { builderVariant = 'a' } = element.attributes;
  if (isExperimentVariant(builderVariant) && indexOfVariant(builderVariant) < count) {
    return;
  }

  const has = EXPERIMENT_VARIANTS.slice(0, count).map(variant => `'${variant}'`);
  ctx.warn(
    'experiment-builder-variant',
    `A/B test "${element.id}" shows \`builderVariant: ${JSON.stringify(builderVariant)}\` in the builder, a variant it does not have, so the builder shows A. It has ${has.join(', ')}.`,
    element.id
  );
};

/**
 * The space's A/B tests: each named, its variants in place with a weight each, the builder shown one of them — and the
 * tests that share an experiment agreeing on its weights, since only the first one met is read.
 */
export const lintExperiments = (ctx: LintContext): void => {
  const firsts = new Map<string, { weights: number[]; id: string }>();
  for (const { element, flat } of allElements(ctx.schema)) {
    if (element.definition.type !== AB_TEST_TYPE) {
      continue;
    }

    const variants = lintVariants(ctx, element, flat);
    const weights = lintWeights(ctx, element, variants);
    lintBuilderVariant(ctx, element, variants.length);
    const name = lintName(ctx, element, element.attributes.experiment);
    if (name === undefined || weights === undefined) {
      continue;
    }

    const first = firsts.get(name);
    if (!first) {
      firsts.set(name, { weights, id: element.id });
    } else if (first.weights.join() !== weights.join()) {
      ctx.warn(
        'experiment-weights-differ',
        `A/B tests "${first.id}" and "${element.id}" both run the experiment "${name}" — a visitor sees the same variant of both — but weigh their variants ${first.weights.join('/')} and ${weights.join('/')}. Only the first is read: give both the same weights, or "${element.id}" an experiment of its own.`,
        element.id
      );
    }
  }
};
