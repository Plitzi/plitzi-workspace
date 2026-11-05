import { evaluateRules } from './evaluator';

import type { RuleGroup, RuleValue } from './types';

/**
 * Evaluates a `when` rule group against a value bag: how every reader decides one — an interaction in the browser, the
 * builder's preview, a flag, an action on the server.
 *
 * `whenMissing` is what a rule whose field the bag does not have answers: `false` by default, `true` for a binding's
 * condition, which reads a source that may not have loaded yet.
 */
export const evaluateRuleGroup = (
  group: RuleGroup,
  values: Record<string, RuleValue>,
  { whenMissing = false }: { whenMissing?: boolean } = {}
): boolean =>
  // The evaluator answers `NestedBoolean` — a group can come back as an array of its members' results — and every
  // caller uses it in a boolean position. Coercing here keeps exactly the truthiness the client engine already
  // applies, rather than inventing a different reading of a nested result on the server.
  Boolean(evaluateRules(group, values, false, whenMissing));

const isRuleValue = (value: unknown): value is RuleValue =>
  typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'bigint';

/** A value bag as a rule group reads it: what no rule can compare — a function, a symbol — left out. */
export const ruleValuesOf = (values: Record<string, unknown>): Record<string, RuleValue> =>
  Object.fromEntries(Object.entries(values).filter((entry): entry is [string, RuleValue] => isRuleValue(entry[1])));
