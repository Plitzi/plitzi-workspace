import type { Rule, RuleGroup } from './types';

export const isNumeric = (value: unknown): value is number | string =>
  typeof value === 'number' || (typeof value === 'string' && !value.includes(',') && !Number.isNaN(parseFloat(value)));

export const isRuleGroup = (rule: Rule | RuleGroup): rule is RuleGroup => 'rules' in rule;
