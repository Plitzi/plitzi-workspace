import { AUTHORING_CODES, isSuggestionCode } from '../codes';

import type { LintContext } from './context';

/** Every suggestion's code, in the order the table holds them: what `quiet` may name. */
const SUGGESTION_CODES = Object.entries(AUTHORING_CODES)
  .filter(([, entry]) => entry.kind === 'suggested')
  .map(([code]) => code);

/**
 * An element's `quiet` as a document holds it — written by authoring, the builder or the MCP: suggestions' codes and
 * only those. A problem is never quieted, and a misspelt code quiets nothing while reading as if it did.
 */
export const lintQuiet = (ctx: LintContext): void => {
  Object.values(ctx.flat).forEach(element => {
    const wrong = (element.definition.quiet ?? []).filter(code => !isSuggestionCode(code));
    if (wrong.length > 0) {
      ctx.error(
        'quiet-unknown',
        `${ctx.describe(element.id)} quiets ${wrong.map(code => `"${code}"`).join(', ')}, which ${wrong.length === 1 ? 'is' : 'are'} no suggestion's code. \`quiet\` lists the codes suggestions are offered with: ${SUGGESTION_CODES.join(', ')}.`,
        element.id
      );
    }
  });
};
