import type { LintContext } from './context';

/**
 * A colour token with a light value and no dark one: a dark theme shows the light value, which is how a near-black
 * text ends up on a near-black background.
 */
export const lintStyle = (ctx: LintContext): void => {
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
