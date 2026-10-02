import { hasConditions, isFlagName } from '@plitzi/sdk-shared/flags';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { Element, Schema } from '@plitzi/sdk-shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every element of the space, in the pages' tree and in every component's. */
const allElements = (schema: Schema): Element[] => [
  ...Object.values(schema.flat),
  ...Object.values(schema.components).flatMap(component => Object.values(component.flat))
];

/** Whether anything in the space names this flag: a gate, a template, a rule's field. */
const isRead = (name: string, schema: Schema, elements: Element[]): boolean => {
  if (elements.some(element => element.definition.flag?.name === name)) {
    return true;
  }

  const reads = new RegExp(`(?<![\\w.])flags\\.${name}\\b`);

  return (
    elements.some(element => reads.test(JSON.stringify(element))) ||
    Object.values(schema.settings.computed ?? {}).some(template => reads.test(template))
  );
};

/** One declared flag, held to the shape the resolver reads. */
const lintDeclaration = (ctx: LintContext, name: string, flag: unknown): void => {
  const where = `Feature flag "${name}"`;
  if (!isFlagName(name)) {
    ctx.error(
      'flag-name',
      `${where} is not a name a template can read as \`flags.${name}\`. Use letters, digits and "_", starting with a letter or "_": "${name.replace(/[^A-Za-z0-9_]/g, '_')}".`
    );
  }

  if (!isRecord(flag) || typeof flag.value !== 'boolean' || !Array.isArray(flag.rules)) {
    ctx.error(
      'flag-shape',
      `${where} is ${JSON.stringify(flag)}. A flag is { value: true | false, rules: [{ when: { combinator: 'and', rules: [...] }, value: true | false }] } — \`value\` is its answer when no rule matches.`
    );

    return;
  }

  flag.rules.forEach((rule: unknown, index: number) => {
    const at = `${where}, rule ${index + 1}`;
    if (!isRecord(rule) || typeof rule.value !== 'boolean' || !isRecord(rule.when)) {
      ctx.error('flag-rule-shape', `${at} is ${JSON.stringify(rule)}. A rule is { when: { … }, value: true | false }.`);

      return;
    }

    if (!hasConditions(rule.when)) {
      ctx.warn(
        'flag-rule-empty',
        `${at} has no conditions, so it never decides anything — an unfinished rule is skipped, not read as "always". Give it a condition (\`{ field: 'environment', operator: '=', value: 'staging' }\`), or set the flag's \`value\` instead.`
      );
    }
  });
};

/**
 * The space's feature flags: each declared one well formed and read somewhere, and every gate naming one that exists —
 * a gate on a flag the space does not declare reads it as off, so the element is never rendered and nothing says why.
 */
export const lintFlags = (ctx: LintContext): void => {
  const declared = ctx.schema.flags ?? {};
  const elements = allElements(ctx.schema);
  for (const [name, flag] of Object.entries(declared)) {
    lintDeclaration(ctx, name, flag);
    if (isFlagName(name) && !isRead(name, ctx.schema, elements)) {
      ctx.warn(
        'flag-unused',
        `Feature flag "${name}" is declared and nothing reads it — no element or page is gated on it, and no template reads \`flags.${name}\`. Gate what it switches (\`flag: '${name}'\`), or remove it once the feature has shipped.`
      );
    }
  }

  for (const element of elements) {
    const gate = element.definition.flag;
    if (gate && !Object.hasOwn(declared, gate.name)) {
      ctx.error(
        'flag-undeclared',
        `Element "${element.id}" is gated on the feature flag "${gate.name}", which the space does not declare${didYouMean(gate.name, ctx.flags) || '.'} An undeclared flag is off, so it is ${gate.is ? 'never' : 'always'} rendered. Declare it in \`flags\`, or remove the gate.`,
        element.id
      );
    }
  }
};
