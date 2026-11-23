import {
  DEFAULT_VARIANT_WEIGHT,
  EXPERIMENT_VARIANTS,
  experimentNameOf,
  isExperimentWeight
} from '@plitzi/sdk-shared/experiments';
import { hasConditions } from '@plitzi/sdk-shared/flags';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { CHOOSE_BY, chooseByOf, isChooseBy, VARIANT_ITEM_TYPE, variantsElementsOf } from '@plitzi/sdk-shared/variants';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** An experiment nothing runs, read from a template: it reads as nothing, so what it decides is never `'b'`. */
export const reportUnknownExperiment = (ctx: LintContext, name: string, where: string, id?: string): void => {
  ctx.error(
    'experiment-unknown',
    `${where} reads "experiments.${name}", which no Variants element chosen by chance runs${didYouMean(name, ctx.experiments) || '.'} A \`variants\` with \`experiment: '${name}'\` runs it.`,
    id
  );
};

const plural = (count: number, word: string): string => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/** How it chooses: chance or rules — anything else is read as chance. */
const lintChooseBy = (ctx: LintContext, element: Element): void => {
  const { chooseBy } = element.attributes;
  if (chooseBy !== undefined && !isChooseBy(chooseBy)) {
    ctx.error(
      'variants-choose-by',
      `Variants "${element.id}" chooses by ${JSON.stringify(chooseBy)}, which it does not know, so it chooses by chance. It chooses by ${CHOOSE_BY.map(mode => `'${mode}'`).join(' or ')}.`,
      element.id
    );
  }
};

/** Its items, variants and nothing else: by chance two to five (A to E), by rules one at least. */
const lintItems = (ctx: LintContext, element: Element, flat: Schema['flat']): Element[] => {
  const items = element.definition.items ?? [];
  const variants = items.filter(id => Object.hasOwn(flat, id) && flat[id].definition.type === VARIANT_ITEM_TYPE);
  const others = items.filter(id => !variants.includes(id));
  const byChance = chooseByOf(element.attributes) === 'chance';
  const tooFew = variants.length < (byChance ? 2 : 1);
  const tooMany = byChance && variants.length > EXPERIMENT_VARIANTS.length;
  if (tooFew || tooMany || others.length > 0) {
    ctx.error(
      'variants-items',
      `Variants "${element.id}" holds ${plural(variants.length, 'variant')}${others.length > 0 ? ` and ${plural(others.length, 'other element')} (${others.join(', ')})` : ''}. ${byChance ? `By chance it holds two to ${String(EXPERIMENT_VARIANTS.length)} — the first is A, the second B…` : 'By rules it holds one at least'} — and only the variant a visitor is given is shown, so anything else is never seen. Write \`variants({ children: [variantItem([…]), variantItem([…])] })\`.`,
      element.id
    );
  }

  return variants.map(id => flat[id]);
};

/** By chance, each variant's weight a share, and at least one shown: all at 0 shows everybody A. */
const lintWeights = (ctx: LintContext, element: Element, variants: Element[]): number[] | undefined => {
  const counted = variants.slice(0, EXPERIMENT_VARIANTS.length);
  const unread = counted.filter(variant => !isExperimentWeight(variant.attributes.weight ?? DEFAULT_VARIANT_WEIGHT));
  for (const variant of unread) {
    ctx.error(
      'experiment-weight',
      `Variant "${variant.id}" of "${element.id}" has \`weight: ${JSON.stringify(variant.attributes.weight)}\`. It is the variant's share of the visitors against the others': a whole number from 0 to 100 — 90 and 10 show the first to 90%. 0 shows it to nobody.`,
      variant.id
    );
  }

  if (unread.length > 0) {
    return undefined;
  }

  const weights = counted.map(variant =>
    isExperimentWeight(variant.attributes.weight) ? variant.attributes.weight : DEFAULT_VARIANT_WEIGHT
  );
  if (weights.length > 0 && weights.every(weight => weight === 0)) {
    ctx.error(
      'experiment-weight',
      `Every variant of "${element.id}" weighs 0, so none is shown by its share and everybody sees A. Give the variants to show a weight above 0 — one alone ends the test, everybody sees it.`,
      element.id
    );
  }

  return weights;
};

/** By rules, each variant's rule a rule group, read in order: after one for everybody, none is ever shown. */
const lintRules = (ctx: LintContext, element: Element, variants: Element[], byRules: boolean): void => {
  let catchAll: string | undefined;
  for (const variant of variants) {
    const { when } = variant.attributes;
    if (when !== undefined && !(isRecord(when) && typeof when.combinator === 'string' && Array.isArray(when.rules))) {
      ctx.error(
        'variants-rule',
        `Variant "${variant.id}" has \`when: ${JSON.stringify(when)}\`. It is a rule group — \`{ combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] }\` — or left out, for everybody else.`,
        variant.id
      );
      continue;
    }

    if (!byRules) {
      continue;
    }

    if (catchAll !== undefined) {
      ctx.warn(
        'variants-unreachable',
        `Variant "${variant.id}" comes after "${catchAll}", which has no rule and takes everybody left: it is never shown. Move "${catchAll}" last, or give it a rule.`,
        variant.id
      );
    } else if (!hasConditions(when)) {
      catchAll = variant.id;
    }
  }

  if (byRules && variants.length > 0 && catchAll === undefined) {
    ctx.warn(
      'variants-no-fallback',
      `Every variant of "${element.id}" has a rule, so a visitor matching none is shown nothing. End it with a \`variant\` with no \`when\`, for everybody else.`,
      element.id
    );
  }
};

/** The variant the builder's canvas shows, one it has. */
const lintBuilderVariant = (ctx: LintContext, element: Element, count: number): void => {
  const { builderVariant = 0 } = element.attributes;
  if (
    typeof builderVariant === 'number' &&
    Number.isInteger(builderVariant) &&
    builderVariant >= 0 &&
    builderVariant < count
  ) {
    return;
  }

  ctx.warn(
    'variants-builder-variant',
    `Variants "${element.id}" shows \`builderVariant: ${JSON.stringify(builderVariant)}\` in the builder, a variant it does not have, so the builder shows the first. It is the place of one, from 0 to ${String(Math.max(0, count - 1))}.`,
    element.id
  );
};

/** By chance, its experiment's name: one a template can read and a cookie keep — or none, for the element's own. */
const lintName = (ctx: LintContext, element: Element): string | undefined => {
  const name = experimentNameOf(element);
  const { experiment } = element.attributes;
  if (name === undefined) {
    const shown = typeof experiment === 'string' ? experiment : JSON.stringify(experiment);
    ctx.error(
      'experiment-name',
      `Variants "${element.id}" names its test ${JSON.stringify(experiment)}, which a template cannot read as \`experiments.x\`. Use letters, digits and "_", starting with a letter or "_": "${shown.replace(/[^A-Za-z0-9_]/g, '_')}" — or leave it empty to run it under the element's name.`,
      element.id
    );
  }

  return name;
};

/**
 * The space's Variants: each holding its variants and nothing else, the builder shown one of them; by chance, named,
 * each variant weighed — and the elements sharing a test agreeing on its weights, since only the first one met is read;
 * by rules, each rule a rule group, read as the runtime reads them, the first match deciding.
 */
export const lintVariantsElements = (ctx: LintContext): void => {
  const firsts = new Map<string, { weights: number[]; id: string }>();
  for (const { element, flat } of variantsElementsOf(ctx.schema)) {
    lintChooseBy(ctx, element);
    const variants = lintItems(ctx, element, flat);
    lintBuilderVariant(ctx, element, variants.length);
    const byRules = chooseByOf(element.attributes) === 'rules';
    lintRules(ctx, element, variants, byRules);
    if (byRules) {
      continue;
    }

    const weights = lintWeights(ctx, element, variants);
    const name = lintName(ctx, element);
    if (name === undefined || weights === undefined) {
      continue;
    }

    const first = firsts.get(name);
    if (!first) {
      firsts.set(name, { weights, id: element.id });
    } else if (first.weights.join() !== weights.join()) {
      ctx.warn(
        'experiment-weights-differ',
        `"${first.id}" and "${element.id}" both run the test "${name}" — a visitor sees the same variant of both — but weigh their variants ${first.weights.join('/')} and ${weights.join('/')}. Only the first is read: give both the same shares, or "${element.id}" a test name of its own.`,
        element.id
      );
    }
  }
};
