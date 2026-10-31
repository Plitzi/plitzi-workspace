import { e2eTestProblems, testAccountWarnings } from '../../testing/e2e/problems';
import { unitTestProblems } from '../../testing/unit/problems';

import type { LintContext } from './context';

/**
 * The space's own tests read against the space as it now is: a page renamed, an element removed, a test written wrong —
 * each said with the rest of the space's problems, so whoever changed it hears what it broke, wherever they changed it.
 */
export const lintTests = (ctx: LintContext): void => {
  const { tests } = ctx.schema;
  if (!tests) {
    return;
  }

  for (const problem of [
    ...unitTestProblems(ctx.schema, tests.unit ?? []),
    ...e2eTestProblems(ctx.schema, tests.e2e ?? [])
  ]) {
    ctx.warn('test-unreadable', problem);
  }

  for (const warning of testAccountWarnings(ctx.schema)) {
    ctx.warn('test-account-role-gone', warning);
  }
};
