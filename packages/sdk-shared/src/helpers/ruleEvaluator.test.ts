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

  it('keeps contains a case-insensitive substring check against text', () => {
    expect(evaluateRuleGroup(rule('contains', 'RPG'), { state: { picks: 'an rpg fan' } })).toBe(true);
  });
});
