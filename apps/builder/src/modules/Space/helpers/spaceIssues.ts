import { CombinedGraphQLErrors } from '@apollo/client/core';

import type { TSpaceIssue, TSpaceIssues } from '@plitzi/sdk-shared';

/** What the server answers a publish of a space that would ship broken with, carrying the issues it found. */
export const SPACE_INVALID = 'SPACE_INVALID';

/** Said above the list when it is shown instead of the publish someone asked for. */
export const PUBLISH_REFUSED =
  'This space cannot be published yet: what is listed under Errors would ship broken. Fix it, and publish again.';

export type IssuesLevel = 'clean' | 'warnings' | 'errors';

const isIssue = (value: unknown): value is TSpaceIssue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).code === 'string' &&
  typeof (value as Record<string, unknown>).message === 'string';

/**
 * The issues a refused publish came back with, or undefined when it was refused for anything else — a plan ceiling, a
 * network failure — which is told the way it always was.
 */
export const issuesFromError = (error: unknown): TSpaceIssue[] | undefined => {
  if (!CombinedGraphQLErrors.is(error)) {
    return undefined;
  }

  const refusal = error.errors.find(entry => entry.extensions?.code === SPACE_INVALID);
  const issues = refusal?.extensions?.issues;

  return Array.isArray(issues) ? issues.filter(isIssue) : undefined;
};

/** How many of the issues `SpaceFixIssues` settles on its own — the ones with a single reading. */
export const fixableCount = (issues: TSpaceIssues): number =>
  [...issues.errors, ...issues.warnings].filter(issue => issue.fixable).length;

/** The worst thing in the list: errors stop a publish, warnings only ask to be looked at. */
export const levelOf = (issues: TSpaceIssues): IssuesLevel => {
  if (issues.errors.length > 0) {
    return 'errors';
  }

  return issues.warnings.length > 0 ? 'warnings' : 'clean';
};
