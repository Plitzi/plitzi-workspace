import { describe, expectTypeOf, it } from 'vitest';

import type { Field, Rule, RuleGroup, RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type {
  Field as StoredField,
  Rule as StoredRule,
  RuleGroup as StoredRuleGroup,
  RuleValue as StoredRuleValue
} from '@plitzi/sdk-shared/conditions';

/**
 * Where the stored condition (`@plitzi/sdk-shared/conditions`, the schema's format) meets the editor that writes it
 * (plitzi-ui's QueryBuilder, with prop types of its own): the two are held assignable both ways, so a group the editor
 * writes is one the evaluator reads, and the other way round (docs/en/server-packages.md, D13).
 */
describe('a condition, as stored and as edited', () => {
  it('is the same shape on both sides', () => {
    expectTypeOf<StoredRuleGroup>().toExtend<RuleGroup>();
    expectTypeOf<RuleGroup>().toExtend<StoredRuleGroup>();
    expectTypeOf<StoredRule>().toExtend<Rule>();
    expectTypeOf<Rule>().toExtend<StoredRule>();
    expectTypeOf<StoredRuleValue>().toExtend<RuleValue>();
    expectTypeOf<RuleValue>().toExtend<StoredRuleValue>();
    expectTypeOf<StoredField>().toExtend<Field>();
    expectTypeOf<Field>().toExtend<StoredField>();
  });
});
