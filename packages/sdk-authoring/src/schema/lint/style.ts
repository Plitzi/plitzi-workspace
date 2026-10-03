import type { LintContext } from './context';
import type { StyleBlock, StyleItem, StyleObject, StyleVariables } from '@plitzi/sdk-shared';

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

const objectsOf = (block: Omit<StyleBlock, 'variants' | 'ancestors'> & Partial<StyleBlock>): StyleObject[] => [
  ...(block.default ? [block.default] : []),
  ...Object.values(block.states ?? {}),
  ...Object.values(block.variants ?? {}).flatMap(objectsOf),
  ...Object.values(block.ancestors ?? {}).flatMap(objectsOf)
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

export const lintStyle = (ctx: LintContext): void => {
  lintColours(ctx);
  lintVariables(ctx);
};
