import { describe, expect, it } from 'vitest';

import { audienceRuleFields } from './ruleFields';
import { ruleSummary } from './ruleSummary';

const fields = audienceRuleFields({ routeParams: {}, queryParams: { utm_source: 'x' }, visitorRoles: [] });
const rule = (field: string, value: unknown, operator = '=') => ({ field, operator, value });

describe('a variant’s rule in words', () => {
  it('reads each condition by its field’s label, joined as the group joins them', () => {
    expect(
      ruleSummary(
        { combinator: 'and', rules: [rule('visitor.language', 'es'), rule('visitor.device', 'mobile')] },
        fields
      )
    ).toBe('Visitor language is es and Visitor device is mobile');
    expect(ruleSummary({ combinator: 'or', rules: [rule('queryParams.utm_source', 'newsletter')] }, fields)).toBe(
      'utm_source is newsletter'
    );
  });

  it('reads a yes-or-no field as itself, and a group inside another in brackets', () => {
    expect(
      ruleSummary(
        {
          combinator: 'and',
          rules: [rule('visitor.returning', true), { combinator: 'or', rules: [rule('user.authenticated', false)] }]
        },
        fields
      )
    ).toBe('Visitor came before and (not Visitor is signed in)');
  });

  it('is nothing for a rule with no conditions — the variant for everybody else', () => {
    expect(ruleSummary({ combinator: 'and', rules: [] }, fields)).toBe('');
    expect(ruleSummary(undefined, fields)).toBe('');
  });
});
