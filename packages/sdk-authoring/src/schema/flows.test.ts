import { describe, expect, it } from 'vitest';

import { authorFlow, named, when, whenFailed, whenSucceeded } from './flows';

import type { StepSpec } from './types';

const step = (action: string): StepSpec => ({ type: 'globalCallback', action, on: 'state' });

/**
 * Conditions on a step, which is how a flow says "only if".
 *
 * A flow is a list and never a tree, so everything conditional in it is expressed on the steps. Written out that
 * is a query-builder group — a combinator wrapping a list of rules — and four levels of nesting to ask whether the
 * step before this one worked is how a page ends up with the condition subtly wrong and nothing saying so.
 */
describe('when', () => {
  it('wraps a single rule in the group the document stores', () => {
    const conditional = when({ field: 'save.status', operator: '=', value: 'completed' }, step('setState'));

    expect(conditional.when).toEqual({
      combinator: 'and',
      rules: [{ field: 'save.status', operator: '=', value: 'completed' }]
    });
  });

  it('takes several rules, and the combinator', () => {
    const conditional = when(
      [
        { field: 'a.status', operator: '=', value: 'completed' },
        { field: 'b.status', operator: '=', value: 'completed' }
      ],
      step('setState'),
      'or'
    );

    expect(conditional.when).toMatchObject({ combinator: 'or', rules: [{ field: 'a.status' }, { field: 'b.status' }] });
  });

  it('leaves the rest of the step exactly as it was', () => {
    const original = named('mark', step('setState'));
    const conditional = whenSucceeded('save', original);

    expect({ ...conditional, when: undefined }).toEqual({ ...original, when: undefined });
  });

  /**
   * A run comes back `completed`, `failed`, `skipped` or `aborted`. To the page the last three are one event — it
   * did not work — so the failure side matches everything that is not `completed` rather than only `failed`.
   */
  it('reads success as completed and failure as everything else', () => {
    expect(whenSucceeded('save', step('navigate')).when).toMatchObject({
      rules: [{ field: 'save.status', operator: '=', value: 'completed' }]
    });
    expect(whenFailed('save', step('setState')).when).toMatchObject({
      rules: [{ field: 'save.status', operator: '!=', value: 'completed' }]
    });
  });

  it('reaches the authored node, where the runtime reads it', () => {
    const nodes = authorFlow('p', [whenSucceeded('save', named('go', step('navigate')))]);

    expect(nodes.go.when).toMatchObject({ rules: [{ field: 'save.status' }] });
  });

  /** A step with no condition carries no `when` at all, rather than an empty group that evaluates to nothing. */
  it('writes no condition when none was asked for', () => {
    expect(authorFlow('p', [named('go', step('navigate'))]).go).not.toHaveProperty('when');
  });
});
