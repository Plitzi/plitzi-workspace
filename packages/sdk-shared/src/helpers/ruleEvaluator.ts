import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder/helpers';

import type { RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

/**
 * Evaluates a `when` rule group against a value bag.
 *
 * A rule group has to be evaluated on both sides — the browser for an interaction, the server for an action — and
 * the only implementation lives in `plitzi-ui`. This wrapper exists for two reasons beyond naming:
 *
 * - the `@plitzi/plitzi-ui/QueryBuilder` BARREL pulls the React components with it, which is the boot weight the
 *   MCP already paid for once. `/QueryBuilder/helpers` carries the evaluator and nothing that renders;
 * - it keeps `plitzi-ui` out of the server's dependency list. `sdk-shared` already depends on it, so the chain is
 *   declared in exactly one place.
 */
export const evaluateRuleGroup = (group: RuleGroup, values: Record<string, RuleValue>): boolean =>
  // The evaluator answers `NestedBoolean` — a group can come back as an array of its members' results — and every
  // caller uses it in a boolean position. Coercing here keeps exactly the truthiness the client engine already
  // applies, rather than inventing a different reading of a nested result on the server.
  Boolean(QueryBuilderEvaluator(group, values));

export type { Rule, RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
