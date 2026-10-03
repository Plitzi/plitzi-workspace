import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

/** What a new rule starts as: no conditions yet. */
export const EMPTY_WHEN: RuleGroup = { combinator: 'and', rules: [] };

/** A rule's `when` as the query builder edits it: `and` or `or` over a list of conditions and groups. */
export const isRuleGroup = (value: unknown): value is RuleGroup =>
  isRecord(value) && (value.combinator === 'and' || value.combinator === 'or') && Array.isArray(value.rules);
