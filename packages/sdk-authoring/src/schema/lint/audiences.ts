import { AUDIENCE_TYPE, AUDIENCE_VARIANT_TYPE } from '@plitzi/sdk-shared/audiences';
import { hasConditions } from '@plitzi/sdk-shared/flags';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { LintContext } from './context';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** Every audience of the space, in the pages' tree and in every component's, each with the tree it is in. */
const audiencesOf = (schema: Schema): { element: Element; flat: Schema['flat'] }[] =>
  [schema.flat, ...Object.values(schema.components).map(component => component.flat)].flatMap(flat =>
    Object.values(flat)
      .filter(element => element.definition.type === AUDIENCE_TYPE)
      .map(element => ({ element, flat }))
  );

/** A rule group as the evaluator reads one: a combinator and its rules. */
const isRuleGroup = (value: unknown): boolean =>
  isRecord(value) && typeof value.combinator === 'string' && Array.isArray(value.rules);

/**
 * The space's audiences: each holding its variants and nothing else, each variant's rule a rule group — and the order
 * read as the runtime reads it, the first match deciding: a variant after one with no conditions is never shown, and an
 * audience with no such variant shows nothing to a visitor matching none.
 */
export const lintAudiences = (ctx: LintContext): void => {
  for (const { element, flat } of audiencesOf(ctx.schema)) {
    const items = element.definition.items ?? [];
    const variants = items.filter(id => Object.hasOwn(flat, id) && flat[id].definition.type === AUDIENCE_VARIANT_TYPE);
    const others = items.filter(id => !variants.includes(id));
    if (variants.length === 0 || others.length > 0) {
      ctx.error(
        'audience-variants',
        `Audience "${element.id}" holds ${variants.length} audienceVariant${variants.length === 1 ? '' : 's'}${others.length > 0 ? ` and ${others.join(', ')} beside them` : ''}. It shows one of its variants and nothing else: write \`audience({ children: [audienceVariant({ when, children }), audienceVariant([…])] })\`.`,
        element.id
      );
    }

    let catchAll: string | undefined;
    for (const id of variants) {
      const { when } = flat[id].attributes;
      if (when !== undefined && !isRuleGroup(when)) {
        ctx.error(
          'audience-rule',
          `Audience variant "${id}" has \`when: ${JSON.stringify(when)}\`. It is a rule group — \`{ combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] }\` — or left out, for everybody else.`,
          id
        );
        continue;
      }

      if (catchAll !== undefined) {
        ctx.warn(
          'audience-unreachable',
          `Audience variant "${id}" comes after "${catchAll}", which has no conditions and takes everybody left: it is never shown. Move "${catchAll}" last, or give it a rule.`,
          id
        );
      } else if (!hasConditions(when)) {
        catchAll = id;
      }
    }

    if (variants.length > 0 && catchAll === undefined) {
      ctx.warn(
        'audience-no-fallback',
        `Every variant of audience "${element.id}" has a rule, so a visitor matching none is shown nothing. End it with an \`audienceVariant\` with no \`when\`, for everybody else.`,
        element.id
      );
    }
  }
};
