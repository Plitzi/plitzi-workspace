import { LintContext } from './context';
import { lintElements } from './elements';
import { lintFlows } from './flows';
import { lintPages } from './pages';
import { lintStyle } from './style';
import { lintComputed } from './templates';

import type { LintCatalogs, LintIssue } from './context';
import type { Schema, Style } from '@plitzi/sdk-shared';

export type { LintCatalogs, LintIssue } from './context';
export { FIXABLE_CODES, fixSpace } from './fixes';
export type { AppliedFix, FixResult } from './fixes';

export interface LintResult {
  /** What renders something other than what the document says — a template read past, a link to nowhere. */
  errors: LintIssue[];
  /** What renders, and probably not as meant — a modal open on arrival, a colour with no dark value. */
  warnings: LintIssue[];
}

/**
 * What a space's documents mean, checked: every template, flow, binding, attribute and link against the vocabularies
 * the elements, the interactions and the transformers declare.
 *
 * The structure — ids, parents, pages, flow chains — is `validateSchema`'s, and this reads a document that passed it.
 * One gate for every door a document comes through: `authorSpace` runs it on what it writes, `validateSpace` on what
 * it is handed, and the builder, the MCP and the server on what they are about to save or publish. A rule added here
 * holds everywhere at once.
 */
export const lintSpace = (
  { schema, style }: { schema: Schema; style: Style },
  catalogs: LintCatalogs = {}
): LintResult => {
  const ctx = new LintContext(schema, style, catalogs);
  lintPages(ctx);
  lintComputed(ctx);
  lintElements(ctx);
  lintFlows(ctx);
  lintStyle(ctx);

  return { errors: ctx.errors, warnings: ctx.warnings };
};
