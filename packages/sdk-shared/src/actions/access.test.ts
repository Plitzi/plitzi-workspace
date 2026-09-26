import { describe, expect, it } from 'vitest';

import { accessRefusal } from './access';

describe('accessRefusal', () => {
  it('lets anyone through a public rule', () => {
    expect(accessRefusal({ mode: 'public' }, undefined)).toBeUndefined();
  });

  it('asks for a session, then for every permission of a role rule', () => {
    expect(accessRefusal({ mode: 'session' }, undefined)).toBe('unauthenticated');
    expect(accessRefusal({ mode: 'session' }, { permissions: [] })).toBeUndefined();
    expect(accessRefusal({ mode: 'role', permissions: ['a', 'b'] }, { permissions: ['a'] })).toBe('forbidden');
    expect(accessRefusal({ mode: 'role', permissions: ['a'] }, { permissions: ['a', 'b'] })).toBeUndefined();
  });

  it('refuses what declares no rule at all', () => {
    expect(accessRefusal(undefined, { permissions: ['a'] })).toBe('forbidden');
  });
});
