import { lintAccessibility } from './accessibility';
import { lintAnchors } from './anchors';
import { lintChannels } from './channels';
import { lintInstances } from './components';
import { LintContext } from './context';
import { lintElements } from './elements';
import { lintFlags } from './flags';
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
  lintFlags(ctx);
  lintElements(ctx);
  lintAnchors(ctx);
  lintInstances(ctx);
  lintChannels(ctx);
  lintFlows(ctx);
  lintStyle(ctx);
  lintAccessibility(ctx);

  // Each component's tree, read as what it is: closed, with nothing around it but `props` and the globals. The rules
  // that are about the whole space — pages, computed values, flags, channels, the stylesheet — were read above, once.
  const errors = [...ctx.errors];
  const warnings = [...ctx.warnings];
  for (const component of Object.values(schema.components)) {
    const own = new LintContext(schema, style, catalogs, component);
    lintElements(own);
    lintAnchors(own);
    lintInstances(own);
    lintFlows(own);
    lintAccessibility(own);
    errors.push(...own.errors);
    warnings.push(...own.warnings);
  }

  return { errors, warnings };
};
