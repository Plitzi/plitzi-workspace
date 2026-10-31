import { describe, expect, it } from 'vitest';

import { authorFlow, authorFlows, named, when, whenFailed, whenSucceeded } from './flows';

import type { Rule } from './flows';
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

  /** `empty` asks whether the field holds anything: there is nothing to compare it with. */
  it('takes `empty` and `notEmpty` with no value', () => {
    const conditional = when({ field: 'state.myName', operator: 'empty' }, step('setState'));

    expect(conditional.when?.rules).toEqual([{ field: 'state.myName', operator: 'empty', value: '' }]);
    // @ts-expect-error — an operator that compares the field with something needs that something.
    when({ field: 'state.myName', operator: '=' }, step('setState'));
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
    const nodes = authorFlow([whenSucceeded('save', named('go', step('navigate')))]);

    expect(nodes.go.when).toMatchObject({ rules: [{ field: 'save.status' }] });
  });

  const ruleA: Rule = { field: 'form.valid', operator: '=', value: true };
  const ruleB: Rule = { field: 'state.ready', operator: '=', value: true };

  /**
   * A helper that returns its steps already guarded, and a caller adding a guard of its own: both must hold. This used
   * to REPLACE the inner condition, so the step ran whenever the outer one held — and nothing said so.
   */
  it('keeps the condition a step already has, and adds the new one to it', () => {
    expect(when(ruleA, when(ruleB, step('setState'))).when).toEqual({ combinator: 'and', rules: [ruleA, ruleB] });
  });

  it('keeps an `or` group whole beside the new condition', () => {
    const guarded = when(ruleA, when([ruleA, ruleB], step('setState'), 'or'));

    expect(guarded.when).toEqual({
      combinator: 'and',
      rules: [
        { combinator: 'and', rules: [ruleA] },
        { combinator: 'or', rules: [ruleA, ruleB] }
      ]
    });
  });

  it('keeps whenFailed guarding on the step status when wrapped again', () => {
    expect(when(ruleA, whenFailed('save', step('setState'))).when?.rules).toEqual([
      ruleA,
      { field: 'save.status', operator: '!=', value: 'completed' }
    ]);
  });

  /** A step with no condition carries no `when` at all, rather than an empty group that evaluates to nothing. */
  it('writes no condition when none was asked for', () => {
    expect(authorFlow([named('go', step('navigate'))]).go).not.toHaveProperty('when');
  });
});

/** An element's flows land in one record keyed by step id: no step of one may take the place of another's. */
describe('authorFlows', () => {
  const trigger = (action: string): StepSpec => ({ type: 'trigger', action });

  // A shared step written without a name, in a flow beside one that named its steps as the minted ones would be.
  it('names an unnamed step past what any flow of the element named by hand', () => {
    const shared = step('setState');
    const nodes = authorFlows(
      [
        [trigger('onLoad'), shared],
        [named('picked', trigger('picked')), named('setState-1', step('setState')), named('setState-2', shared)]
      ],
      'map'
    );

    expect(Object.keys(nodes)).toEqual(['onLoad-1', 'setState-3', 'picked', 'setState-1', 'setState-2']);
    expect(nodes['setState-1'].flowId).toBe('picked');
    expect(nodes['setState-3'].flowId).toBe('onLoad-1');
  });

  it('refuses one name given to steps of two flows', () => {
    expect(() =>
      authorFlows([[named('go', trigger('onClick'))], [trigger('onLoad'), named('go', step('navigate'))]], 'map')
    ).toThrow('Two flows on "map" name a step "go"');
  });
});
