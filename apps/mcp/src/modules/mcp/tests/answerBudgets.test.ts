import { describe, expect, it } from 'vitest';

import { ANSWER_BUDGETS as budgets } from './answerBudgets';
import { largeSpace } from './largeSpace';
import { defsUri, globalsUri, interactionsUri, pageUri, primerUri, styleVarsUri, typesUri } from '../helpers';
import { readResource } from '../resources';
import { search } from '../tools';
import { describeOperation } from '../tools/describeOperation';

/**
 * What each answer costs an agent's context, on a space as large as a busy one (30 pages of 100 elements, 200 classes),
 * held to a ceiling: the `wasted` ratchet of renders, for words (RFC 0033 A4). Tokens are estimated at four characters
 * each — the measure is the same on every run, which is what a ratchet needs.
 *
 * A budget watches; it never decides what an agent may see. An answer that grows past its ceiling because it says
 * something the agent needs raises the ceiling in `answerBudgets.ts`, said in the change; what is cut is what is
 * said twice, never a field — an agent that does not see one cannot use it, and is confused when it meets it.
 * `plitzi_look`, `plitzi_activity` and `plitzi_test` answer from the render, the history and a runner: they are
 * measured where those run.
 */

const space = largeSpace(30, 100, 200);

const tokensOf = (answer: unknown): number => Math.ceil(JSON.stringify(answer).length / 4);

const ANSWERS: Record<keyof typeof budgets, () => unknown> = {
  'plitzi://primer': () => readResource(space, 'main', primerUri('main')),
  'plitzi://schema/…/pages/{ref}': () => readResource(space, 'main', pageUri('main', 'home-29')),
  'plitzi://schema/…/elements/{ref}': () => readResource(space, 'main', 'plitzi://schema/main/elements/el-29-100'),
  'plitzi://definitions': () => readResource(space, 'main', defsUri('main')),
  'plitzi://types': () => readResource(space, 'main', typesUri),
  'plitzi://global-styles': () => readResource(space, 'main', globalsUri('main')),
  'plitzi://interactions': () => readResource(space, 'main', interactionsUri('main')),
  'plitzi://style-variables': () => readResource(space, 'main', styleVarsUri('main')),
  plitzi_search: () => search({ query: 'box' }, space, 'main'),
  'plitzi_search include detail': () => search({ query: 'box', include: 'detail' }, space, 'main'),
  plitzi_describe_operation: () => describeOperation(undefined),
  'plitzi_describe_operation upsertElement': () => describeOperation('upsertElement')
};

describe('what each answer costs, on a large space', () => {
  for (const [name, answer] of Object.entries(ANSWERS)) {
    // `Object.entries` widens a key to a string; these are ANSWERS', which has the table's keys by its type.
    const ceiling = budgets[name as keyof typeof budgets];

    it(`${name} stays within its ${String(ceiling)} tokens`, () => {
      const value = answer();
      const tokens = tokensOf(value);

      expect(value, `${name} answered nothing`).not.toBeNull();
      expect(
        tokens,
        `${name} is ${String(tokens)} tokens, past its ${String(ceiling)}: if it says what an agent needs, raise its ceiling in answerBudgets.ts and say so; if it says something twice, cut that`
      ).toBeLessThanOrEqual(ceiling);
    });
  }

  it('measures every answer the table names, and the table names every answer measured', () => {
    expect(Object.keys(ANSWERS).sort()).toEqual(Object.keys(budgets).sort());
  });
});
