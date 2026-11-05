/**
 * Conditions as Plitzi evaluates them: the rule evaluator and the stored format it reads. One evaluator for every reader
 * — the builder's preview, the SDK, a page server, a worker — so one condition is never decided two ways. Server-safe:
 * no React, no UI library.
 */
export { evaluateRuleGroup, ruleValuesOf } from './evaluateRuleGroup';
export * from './evaluator';
export { isNumeric, isRuleGroup } from './rules';
export { isDate, toUnixSeconds } from './dates';

export type { Combinator, Field, Operator, Rule, RuleGroup, RuleValue } from './types';
