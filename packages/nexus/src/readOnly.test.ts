import { describe, it, expect } from 'vitest';

import createStore from './createStore/createStore';

// In the test environment `MODE === 'test'`, so `isDev` is true and read-only violations throw (the dev behavior).
// In production the same writes are silently dropped instead.
describe('read-only paths (dev behavior)', () => {
  it('throws on a direct write to a read-only path', () => {
    const store = createStore<{ config: { theme: string } }>(() => ({ config: { theme: 'light' } }), {
      readOnly: ['config']
    });

    expect(() => store.setState('config', { theme: 'dark' })).toThrow(/read-only path "config"/);
    expect(store.getState().config.theme).toBe('light');
  });

  it('throws on a write to a descendant of a read-only path', () => {
    const store = createStore<{ config: { theme: string } }>(() => ({ config: { theme: 'light' } }), {
      readOnly: ['config']
    });

    expect(() => store.setState('config.theme', 'dark')).toThrow(/read-only path "config.theme"/);
    expect(store.getState().config.theme).toBe('light');
  });

  it('throws on a write to an ancestor that would replace a read-only subtree', () => {
    type State = { config: { theme: string; nested: { locked: boolean } } };
    const store = createStore<State>(() => ({ config: { theme: 'light', nested: { locked: true } } }), {
      readOnly: ['config.nested']
    });

    expect(() => store.setState('config', { theme: 'dark', nested: { locked: false } })).toThrow(
      /read-only path "config"/
    );
  });

  it('throws on a whole-state replace that changes a read-only path', () => {
    const store = createStore<{ a: number; locked: number }>(() => ({ a: 1, locked: 42 }), { readOnly: ['locked'] });

    expect(() => store.setState(undefined, { a: 2, locked: 99 })).toThrow(/read-only path "locked"/);
  });

  it('allows a whole-state replace that leaves the read-only path untouched', () => {
    const store = createStore<{ a: number; locked: { v: number } }>(() => ({ a: 1, locked: { v: 42 } }), {
      readOnly: ['locked']
    });
    const lockedBefore = store.getState().locked;

    store.setState(undefined, prev => ({ ...prev, a: 2 }));

    expect(store.getState().a).toBe(2);
    expect(store.getState().locked).toBe(lockedBefore);
  });

  it('allows writes to unrelated paths', () => {
    const store = createStore<{ a: number; locked: number }>(() => ({ a: 1, locked: 42 }), { readOnly: ['locked'] });

    store.setState('a', 5);

    expect(store.getState().a).toBe(5);
  });

  it('blocks unmounting a read-only path', () => {
    const store = createStore<Record<string, unknown>>(() => ({ locked: 1, a: 2 }), { readOnly: ['locked'] });

    expect(() => store.setState('locked', undefined, { unmount: true })).toThrow(/read-only path "locked"/);
    expect(Object.hasOwn(store.getState(), 'locked')).toBe(true);
  });

  it('does not restrict anything when readOnly is omitted', () => {
    const store = createStore<{ config: { theme: string } }>(() => ({ config: { theme: 'light' } }));

    store.setState('config.theme', 'dark');

    expect(store.getState().config.theme).toBe('dark');
  });

  it('rejects a read-only write before it can delegate to a parent', () => {
    type State = { locked: number };
    const parent = createStore<State>(() => ({ locked: 1 }));
    const child = createStore<State>(() => ({}), { parent, readOnly: ['locked'] });

    expect(() => child.setState('locked', 2)).toThrow(/read-only path "locked"/);
    expect(parent.getState().locked).toBe(1);
  });
});
