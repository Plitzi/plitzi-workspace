import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder/evaluator';

import type { RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder/evaluator';

/**
 * Evaluates a `when` rule group against a value bag.
 *
 * A rule group has to be evaluated on both sides — the browser for an interaction, the server for an action — and
 * the only implementation lives in `plitzi-ui`. This wrapper exists for two reasons beyond naming:
 *
 * - the `@plitzi/plitzi-ui/QueryBuilder` BARREL pulls the React components with it, and `/QueryBuilder/helpers` the
 *   SQL and MongoDB formatters; `/QueryBuilder/evaluator` is the evaluator alone, which is all a server loads;
 * - it keeps `plitzi-ui` out of the server's dependency list. `sdk-shared` already depends on it, so the chain is
 *   declared in exactly one place.
 */
export const evaluateRuleGroup = (group: RuleGroup, values: Record<string, RuleValue>): boolean =>
  // The evaluator answers `NestedBoolean` — a group can come back as an array of its members' results — and every
  // caller uses it in a boolean position. Coercing here keeps exactly the truthiness the client engine already
  // applies, rather than inventing a different reading of a nested result on the server.
  Boolean(QueryBuilderEvaluator(group, values));

const isRuleValue = (value: unknown): value is RuleValue =>
  typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'bigint';

/** A value bag as a rule group reads it: what no rule can compare — a function, a symbol — left out. */
export const ruleValuesOf = (values: Record<string, unknown>): Record<string, RuleValue> =>
  Object.fromEntries(Object.entries(values).filter((entry): entry is [string, RuleValue] => isRuleValue(entry[1])));

export type { Rule, RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder/evaluator';
