import { describe, expect, it } from 'vitest';

import { isRuleGroup } from './ruleGroup';

describe('isRuleGroup', () => {
  it('takes a group, empty or not', () => {
    expect(isRuleGroup({ combinator: 'and', rules: [] })).toBe(true);
    expect(isRuleGroup({ combinator: 'or', rules: [{ field: 'country', operator: '=', value: 'ES' }] })).toBe(true);
  });

  it('refuses anything a group is not', () => {
    expect(isRuleGroup(undefined)).toBe(false);
    expect(isRuleGroup({ rules: [] })).toBe(false);
    expect(isRuleGroup({ combinator: 'xor', rules: [] })).toBe(false);
    expect(isRuleGroup({ combinator: 'and', rules: {} })).toBe(false);
  });
});
