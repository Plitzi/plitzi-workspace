import { describe, expect, it } from 'vitest';

import { evaluateRuleGroup } from './ruleEvaluator';

import type { RuleGroup } from './ruleEvaluator';

const rule = (operator: 'contains' | 'doesNotContain', value: string): RuleGroup => ({
  combinator: 'and',
  rules: [{ field: 'state.picks', operator, value }]
});

describe('evaluateRuleGroup', () => {
  // What a quiz gated on its answers is written as. Against a list the rule used to be false every time, so the flow
  // behind it never ran and the result it was meant to write never appeared.
  it('reads contains against a state list as membership', () => {
    const values = { state: { picks: ['arcade', 'rpg'] } };

    expect(evaluateRuleGroup(rule('contains', 'rpg'), values)).toBe(true);
    expect(evaluateRuleGroup(rule('contains', 'racer'), values)).toBe(false);
    expect(evaluateRuleGroup(rule('doesNotContain', 'racer'), values)).toBe(true);
  });

  // A limit of three picks written as a rule read nothing — the path stopped at the list — and blocked every press.
  it('reads a list’s length, and compares an unset field to nothing', () => {
    const fewer: RuleGroup = { combinator: 'and', rules: [{ field: 'state.picks.length', operator: '<', value: 3 }] };

    expect(evaluateRuleGroup(fewer, { state: { picks: ['arcade', 'rpg'] } })).toBe(true);
    expect(evaluateRuleGroup(fewer, { state: { picks: ['arcade', 'rpg', 'racer'] } })).toBe(false);
    expect(evaluateRuleGroup(fewer, { state: {} })).toBe(false);
  });

  it('keeps contains a case-insensitive substring check against text', () => {
    expect(evaluateRuleGroup(rule('contains', 'RPG'), { state: { picks: 'an rpg fan' } })).toBe(true);
  });
});
