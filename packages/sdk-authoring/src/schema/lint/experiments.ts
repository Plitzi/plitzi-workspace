import {
  AB_TEST_TYPE,
  AB_TEST_VARIANT_TYPE,
  DEFAULT_EXPERIMENT_SPLIT,
  isExperimentName,
  isExperimentSplit
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

/** Its two sides, A first: a third is never shown, and one missing shows nothing to the visitors drawn it. */
const lintVariants = (ctx: LintContext, element: Element, flat: Schema['flat']): void => {
  const items = element.definition.items ?? [];
  const variants = items.filter(id => Object.hasOwn(flat, id) && flat[id].definition.type === AB_TEST_VARIANT_TYPE);
  if (variants.length === 2 && items.length === 2) {
    return;
  }

  const others = items.filter(id => !variants.includes(id));
  ctx.error(
    'experiment-variants',
    `A/B test "${element.id}" holds ${variants.length} abTestVariant${variants.length === 1 ? '' : 's'}${others.length > 0 ? ` and ${others.length} other element${others.length === 1 ? '' : 's'} (${others.join(', ')})` : ''}. It holds exactly two — the first is A, the second B — and only the side a visitor is drawn is shown, so anything else is never seen. Write \`abTest({ experiment, children: [abTestVariant([…]), abTestVariant([…])] })\`.`,
    element.id
  );
};

/**
 * The space's A/B tests: each named, its split a share of visitors, its two variants in place — and the tests that
 * share an experiment agreeing on its split, since only the first one met is read.
 */
export const lintExperiments = (ctx: LintContext): void => {
  const splits = new Map<string, { split: number; id: string }>();
  for (const { element, flat } of allElements(ctx.schema)) {
    if (element.definition.type !== AB_TEST_TYPE) {
      continue;
    }

    lintVariants(ctx, element, flat);
    const { experiment, split = DEFAULT_EXPERIMENT_SPLIT } = element.attributes;
    if (!isExperimentSplit(split)) {
      ctx.error(
        'experiment-split',
        `A/B test "${element.id}" has \`split: ${JSON.stringify(split)}\`. It is the share of visitors who see variant B: a whole number from 0 to 100 — \`split: 50\` for half. 0 or 100 ends the experiment, showing everybody one side.`,
        element.id
      );
    }

    const name = lintName(ctx, element, experiment);
    if (name === undefined || !isExperimentSplit(split)) {
      continue;
    }

    const first = splits.get(name);
    if (!first) {
      splits.set(name, { split, id: element.id });
    } else if (first.split !== split) {
      ctx.warn(
        'experiment-split-differs',
        `A/B tests "${first.id}" and "${element.id}" both run the experiment "${name}" — a visitor sees the same side of both — but split it ${first.split}% and ${split}%. Only the first is read: give both \`split: ${first.split}\`, or "${element.id}" an experiment of its own.`,
        element.id
      );
    }
  }
};
