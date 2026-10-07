import { animationNamesIn, keyframesNamesIn, SDK_KEYFRAMES_PREFIX } from '@plitzi/sdk-shared/style/keyframes';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { StyleItem, StyleObject, StyleStates, StyleVariables } from '@plitzi/sdk-shared';

/**
 * A colour token with a light value and no dark one: a dark theme shows the light value, which is how a near-black
 * text ends up on a near-black background.
 */
const lintColours = (ctx: LintContext): void => {
  const colours: Record<string, unknown> = { ...ctx.style.variables.color };
  for (const [name, value] of Object.entries(colours)) {
    if (typeof value === 'object' && value !== null && 'light' in value && !('dark' in value)) {
      ctx.warn(
        'colour-without-dark',
        `The colour "${name}" has a light value and no dark one, so a dark theme shows the light value. Give it both: \`${name}: { light: '…', dark: '…', default: '…' }\`.`,
        undefined,
        { name }
      );
    }
  }
};

/** A `var()` with a fallback (`var(--x, 8px)`) says the variable may be missing, so only the bare form is read. */
const BARE_REFERENCE = /var\(\s*(--[\w-]+)\s*\)/g;
const DECLARATION = /(--[\w-]+)\s*:/g;

const variableNames = (variables: Partial<StyleVariables> | undefined): string[] =>
  Object.values(variables ?? {}).flatMap(group => Object.keys(group).map(name => `--${name}`));

/** Any part of a selector's block: its own, a variant, an ancestor's, a pseudo-element's, a condition's. */
interface RulesPart {
  default?: StyleObject;
  states?: StyleStates;
  variants?: Record<string, RulesPart>;
  ancestors?: Record<string, RulesPart>;
  pseudos?: Partial<Record<string, RulesPart>>;
  conditions?: Record<string, RulesPart>;
}

/** Every rule set a block holds, however deep — so a `var()` or an `animation-name` under a `::before` is read too. */
const objectsOf = (block: RulesPart): StyleObject[] => [
  ...(block.default ? [block.default] : []),
  ...Object.values(block.states ?? {}),
  ...[block.variants, block.ancestors, block.pseudos, block.conditions].flatMap(parts =>
    Object.values(parts ?? {}).flatMap(part => (part ? objectsOf(part) : []))
  )
];

const rulesOf = (item: StyleItem): StyleObject[] => Object.values(item.attributes).flatMap(objectsOf);

/**
 * A `var(--x)` nothing declares: the property it is in is dropped by the browser, and the page shows the inherited
 * value — a typo in a token's name is a colour that silently is not there. Declared is a space variable, a variable of
 * a selector, a custom property a rule sets, or one `customCss` sets. Warned, not refused: a plugin's stylesheet can
 * declare one too, out of sight of the space.
 */
const lintVariables = (ctx: LintContext): void => {
  const items = Object.values(ctx.style.platform).flatMap(items => Object.values(items));
  const declared = new Set([
    ...variableNames(ctx.style.variables),
    ...items.flatMap(item => variableNames(item.variables)),
    ...items.flatMap(rulesOf).flatMap(rule => Object.keys(rule).filter(key => key.startsWith('--'))),
    ...Array.from(ctx.schema.settings.customCss.matchAll(DECLARATION), match => match[1])
  ]);

  const reported = new Set<string>();
  for (const item of items) {
    for (const value of rulesOf(item).flatMap(rule => Object.values(rule))) {
      for (const [, name] of String(value).matchAll(BARE_REFERENCE)) {
        if (declared.has(name) || reported.has(name)) {
          continue;
        }

        reported.add(name);
        const known = Array.from(declared).filter(other => other.startsWith('--'));
        ctx.warn(
          'unknown-variable',
          `The ${item.type} "${item.name}" reads \`var(${name})\`, which nothing in the space declares, so the property it is in is dropped. Declare it under \`variables\`${known.length > 0 ? ` or use one that exists: ${known.slice(0, 8).join(', ')}` : ''}; a variable that may be missing on purpose takes a fallback: \`var(${name}, …)\`.`,
          undefined,
          { name, selector: item.name }
        );
      }
    }
  }
};

/**
 * An `animation-name` playing keyframes nothing declares: the animation never runs, and nothing says so. Declared is a
 * keyframes rule of the space's — its `keyframes`, or one written by hand in `customCss` — or one of the SDK's own
 * (`plitzi-…`). Warned, not refused: a plugin's stylesheet can declare one out of sight of the space.
 */
const lintAnimations = (ctx: LintContext): void => {
  const declared = new Set(keyframesNamesIn(ctx.schema.settings.customCss));
  const reported = new Set<string>();
  const items = Object.values(ctx.style.platform).flatMap(items => Object.values(items));
  for (const item of items) {
    for (const rule of rulesOf(item)) {
      const value = rule['animation-name'];
      if (value === undefined) {
        continue;
      }

      for (const name of animationNamesIn(String(value))) {
        if (declared.has(name) || name.startsWith(SDK_KEYFRAMES_PREFIX) || reported.has(name)) {
          continue;
        }

        reported.add(name);
        ctx.warn(
          'animation-name-unknown',
          `The ${item.type} "${item.name}" plays the keyframes "${name}", which the space does not declare, so nothing moves${didYouMean(name, declared)}. Declare them in the space's \`keyframes\` — \`keyframes: { '${name}': { from: { … }, to: { … } } }\` — or name ones it has.`,
          undefined,
          { name, selector: item.name }
        );
      }
    }
  }
};

export const lintStyle = (ctx: LintContext): void => {
  lintColours(ctx);
  lintVariables(ctx);
  lintAnimations(ctx);
};
