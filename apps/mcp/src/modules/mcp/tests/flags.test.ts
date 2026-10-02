import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { apply } from '../tools';

import type { AIElementDetail } from '../types';

const beta = {
  type: 'upsertFlag' as const,
  name: 'beta',
  description: 'The new checkout',
  value: false,
  rules: [
    {
      when: {
        combinator: 'and' as const,
        rules: [{ field: 'user.roles', operator: 'contains' as const, value: 'beta' }]
      },
      value: true
    }
  ]
};

describe('feature flags over MCP', () => {
  it('declares a flag, gates an element on it, and reads both back', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          beta,
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'checkout', type: 'container', flag: 'beta' } },
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'legacy', type: 'container', flag: '!beta' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    expect(readResource(cap.saved(), 'main', 'plitzi://flags/main')?.data).toEqual({
      beta: { description: 'The new checkout', value: false, rules: beta.rules }
    });
    const legacy = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/legacy')?.data as AIElementDetail;
    expect(legacy.flag).toBe('!beta');
  });

  it('removes a gate with a patch, and a flag with deleteFlag', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          beta,
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'checkout', type: 'container', flag: 'beta' } },
          { type: 'patchElement', pageRef: 'home', ref: 'checkout', flag: null },
          { type: 'deleteFlag', name: 'beta' }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    const checkout = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/checkout')
      ?.data as AIElementDetail;
    expect(checkout.flag).toBeUndefined();
    expect(readResource(cap.saved(), 'main', 'plitzi://flags/main')?.data).toEqual({});
  });

  it('refuses a flag name a template cannot read, and removing a flag the space does not declare', async () => {
    const badName = await apply({ operations: [{ ...beta, name: 'new beta' }] }, buildSpace());
    const unknown = await apply({ operations: [{ type: 'deleteFlag', name: 'gone' }] }, buildSpace());

    expect(badName.applied).toBe(false);
    expect(unknown.applied).toBe(false);
  });
});
