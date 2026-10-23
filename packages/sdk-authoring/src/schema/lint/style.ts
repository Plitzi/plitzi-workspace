import { animationNamesIn, keyframesNamesIn, SDK_KEYFRAMES_PREFIX } from '@plitzi/sdk-shared/style';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { StyleItem, StyleObject, StyleStates, StyleValue, StyleVariables } from '@plitzi/sdk-shared';

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

const WEIGHT_KEYWORDS: Record<string, number> = { normal: 400, bold: 700 };

const weightOf = (value: StyleValue | undefined): number | undefined => {
  const text = String(value ?? '').trim();

  return WEIGHT_KEYWORDS[text] ?? (/^\d{3}$/.test(text) ? Number(text) : undefined);
};

/** The family a `font-family` draws first, a token's value followed — `var(--body)` is the family it holds. */
const firstFamily = (ctx: LintContext, value: StyleValue): string | undefined => {
  const tokens = new Map(Object.values(ctx.style.variables).flatMap(group => Object.entries(group)));
  const text = String(value).replace(BARE_REFERENCE, (whole, name: string) => {
    const token = tokens.get(name.slice(2));
    const held = typeof token === 'object' ? token.default : token;

    return typeof held === 'string' ? held : whole;
  });

  return text
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
};

/**
 * A `font-weight` no loaded face has: the browser draws the nearest weight the family loads, or fakes a bolder one —
 * the page asks for 400 and shows 500. Read against the family the selector names, else against every family the space
 * loads, as it inherits one of them; a family the space does not load (a system stack) is the visitor's, unread.
 */
const lintFontWeights = (ctx: LintContext): void => {
  const loaded = new Map(
    (ctx.style.fonts ?? []).filter(font => font.source !== 'system').map(font => [font.family, font.weights] as const)
  );
  if (loaded.size === 0) {
    return;
  }

  const every = new Set([...loaded.values()].flat());
  const items = Object.values(ctx.style.platform).flatMap(items => Object.values(items));
  const reported = new Set<string>();
  for (const item of items) {
    const rules = rulesOf(item);
    const named = rules.map(rule => rule['font-family']).find(value => value !== undefined);
    const family = named === undefined ? undefined : firstFamily(ctx, named);
    if (family !== undefined && !loaded.has(family)) {
      continue;
    }

    const weights = family === undefined ? every : new Set(loaded.get(family));
    for (const weight of rules.map(rule => weightOf(rule['font-weight']))) {
      const key = `${item.name}:${String(weight)}`;
      if (weight === undefined || weights.has(weight) || reported.has(key)) {
        continue;
      }

      reported.add(key);
      const has = [...weights].sort((a, b) => a - b).join(', ');
      ctx.warn(
        'font-weight-not-loaded',
        `The ${item.type} "${item.name}" sets font-weight ${String(weight)}, which ${family === undefined ? `no family the space loads has (${[...loaded].map(([name, own]) => `"${name}" ${own.join('/')}`).join(', ')})` : `"${family}" does not load (it loads ${has})`}: the browser draws the nearest weight it has, or fakes a bolder one. Load the weight — \`weights\` on the font — or write one it has.`,
        undefined,
        { selector: item.name, weight, ...(family === undefined ? {} : { family }) }
      );
    }
  }
};

export const lintStyle = (ctx: LintContext): void => {
  lintColours(ctx);
  lintVariables(ctx);
  lintAnimations(ctx);
  lintFontWeights(ctx);
};
