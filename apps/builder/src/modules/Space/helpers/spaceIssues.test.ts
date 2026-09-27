import { CombinedGraphQLErrors } from '@apollo/client/core';
import { describe, expect, it } from 'vitest';

import { issuesFromError, levelOf, SPACE_INVALID } from './spaceIssues';

const issue = { code: 'binding-target-unknown', message: 'Lands on nothing', elementId: 'hello', fixable: false };

const refusal = (extensions: Record<string, unknown>) =>
  new CombinedGraphQLErrors({ errors: [{ message: 'Refused', extensions }] });

describe('spaceIssues helpers', () => {
  it('reads the issues a publish was refused with', () => {
    expect(issuesFromError(refusal({ code: SPACE_INVALID, issues: [issue] }))).toEqual([issue]);
  });

  it('leaves any other refusal to be told as it always was', () => {
    expect(issuesFromError(refusal({ code: 'PLAN_LIMIT_EXCEEDED' }))).toBeUndefined();
    expect(issuesFromError(new Error('Network down'))).toBeUndefined();
  });

  it('drops an entry that is not an issue rather than rendering it', () => {
    expect(issuesFromError(refusal({ code: SPACE_INVALID, issues: [issue, { code: 1 }, null] }))).toEqual([issue]);
  });

  it('ranks errors over warnings over nothing', () => {
    expect(levelOf({ errors: [issue], warnings: [issue] })).toBe('errors');
    expect(levelOf({ errors: [], warnings: [issue] })).toBe('warnings');
    expect(levelOf({ errors: [], warnings: [] })).toBe('clean');
  });
});
