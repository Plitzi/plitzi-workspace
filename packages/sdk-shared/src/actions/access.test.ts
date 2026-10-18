import { describe, expect, it } from 'vitest';

import { accessRefusal, actionAccessOf } from './access';

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

describe('actionAccessOf', () => {
  it('reads each kind of access, keeping nothing else', () => {
    expect(actionAccessOf({ mode: 'public', extra: 1 })).toEqual({ mode: 'public' });
    expect(actionAccessOf({ mode: 'session' })).toEqual({ mode: 'session' });
    expect(actionAccessOf({ mode: 'role', permissions: ['spaceView'] })).toEqual({
      mode: 'role',
      permissions: ['spaceView']
    });
  });

  it('is nothing for what is not access', () => {
    expect(actionAccessOf(undefined)).toBeUndefined();
    expect(actionAccessOf({ mode: 'anyone' })).toBeUndefined();
    expect(actionAccessOf({ mode: 'role', permissions: [] })).toBeUndefined();
    expect(actionAccessOf({ mode: 'role', permissions: ['spaceView', ''] })).toBeUndefined();
  });
});
