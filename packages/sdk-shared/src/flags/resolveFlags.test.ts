import { describe, expect, it } from 'vitest';

import { flagValues, passesFlagGate, resolveFlags, undeclaredFlagOverrides } from './resolveFlags';

import type { Rule, RuleGroup, RuleValue } from '../helpers/ruleEvaluator';
import type { SchemaFlag } from '../types';

const onFor = (field: string, operator: Rule['operator'], value: RuleValue): RuleGroup => ({
  combinator: 'and',
  rules: [{ field, operator, value }]
});

const flags: Record<string, SchemaFlag> = {
  newCheckout: {
    value: false,
    rules: [
      { when: onFor('environment', '=', 'staging'), value: true },
      { when: onFor('user.roles', 'contains', 'beta'), value: true }
    ]
  },
  legacyNav: { value: true, rules: [] }
};

describe('resolveFlags', () => {
  it('answers with the default when no rule matches', () => {
    expect(resolveFlags(flags, { environment: 'production' })).toEqual({
      newCheckout: { value: false, layer: 'space' },
      legacyNav: { value: true, layer: 'space' }
    });
  });

  it('answers with the first rule that matches, and says which', () => {
    const scope = { environment: 'staging', user: { authenticated: true, roles: ['beta'] } };

    expect(resolveFlags(flags, scope).newCheckout).toEqual({ value: true, layer: 'space', rule: 0 });
    expect(resolveFlags(flags, { ...scope, environment: 'production' }).newCheckout).toEqual({
      value: true,
      layer: 'space',
      rule: 1
    });
  });

  it('skips a rule with no conditions instead of reading it as always', () => {
    const unfinished = { value: false, rules: [{ when: { combinator: 'and' as const, rules: [] }, value: true }] };

    expect(resolveFlags({ unfinished }).unfinished).toEqual({ value: false, layer: 'space' });
  });

  it('lets each layer replace the one below it, the tester last', () => {
    const resolved = resolveFlags(
      flags,
      { environment: 'staging' },
      { server: { newCheckout: false, legacyNav: false }, sdk: { newCheckout: true }, qa: { legacyNav: true } }
    );

    expect(resolved).toEqual({
      newCheckout: { value: true, layer: 'sdk' },
      legacyNav: { value: true, layer: 'qa' }
    });
  });

  it('drops overrides for flags the space does not declare, and names them', () => {
    const overrides = { sdk: { newChekout: true }, qa: { legacyNav: false } };

    expect(Object.keys(resolveFlags(flags, {}, overrides))).toEqual(['newCheckout', 'legacyNav']);
    expect(undeclaredFlagOverrides(flags, overrides)).toEqual([{ layer: 'sdk', name: 'newChekout' }]);
  });

  it('resolves nothing for a space that declares nothing', () => {
    expect(resolveFlags(undefined, {}, { sdk: { anything: true } })).toEqual({});
  });
});

describe('flagValues', () => {
  it('keeps the answers alone', () => {
    expect(flagValues(resolveFlags(flags))).toEqual({ newCheckout: false, legacyNav: true });
  });
});

describe('passesFlagGate', () => {
  it('lets an ungated element through, and a gated one only when its flag agrees', () => {
    expect(passesFlagGate(undefined, {})).toBe(true);
    expect(passesFlagGate({ name: 'a', is: true }, { a: true })).toBe(true);
    expect(passesFlagGate({ name: 'a', is: true }, { a: false })).toBe(false);
    expect(passesFlagGate({ name: 'a', is: false }, { a: false })).toBe(true);
  });

  it('reads an undeclared flag as off', () => {
    expect(passesFlagGate({ name: 'gone', is: true }, {})).toBe(false);
    expect(passesFlagGate({ name: 'gone', is: false }, {})).toBe(true);
  });
});
