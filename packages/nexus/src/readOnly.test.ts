import { describe, it, expect, vi } from 'vitest';

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

  describe('modifying the read-only path itself', () => {
    it('throws on the updater form and never runs the updater', () => {
      const store = createStore<{ locked: number }>(() => ({ locked: 1 }), { readOnly: ['locked'] });
      const updater = vi.fn((v: number) => v + 1);

      expect(() => store.setState('locked', updater)).toThrow(/read-only path "locked"/);
      expect(updater).not.toHaveBeenCalled();
      expect(store.getState().locked).toBe(1);
    });

    it('throws when unmounting the exact read-only path', () => {
      const store = createStore<Record<string, unknown>>(() => ({ locked: 1 }), { readOnly: ['locked'] });

      expect(() => store.setState('locked', undefined, { unmount: true })).toThrow(/read-only path "locked"/);
      expect(store.getState().locked).toBe(1);
    });

    it('throws when writing the exact same value (no early bail before the guard)', () => {
      const store = createStore<{ locked: number }>(() => ({ locked: 1 }), { readOnly: ['locked'] });

      expect(() => store.setState('locked', 1)).toThrow(/read-only path "locked"/);
    });
  });

  describe('modifying an ancestor (parent) of a read-only path', () => {
    it('throws when writing a single-segment parent of a nested read-only path', () => {
      type State = { config: { theme: string } };
      const store = createStore<State>(() => ({ config: { theme: 'light' } }), { readOnly: ['config.theme'] });

      expect(() => store.setState('config', { theme: 'dark' })).toThrow(/read-only path "config"/);
      expect(store.getState().config.theme).toBe('light');
    });

    it('throws when unmounting a parent that holds the read-only subtree', () => {
      type State = { a?: { b?: number } };
      const store = createStore<State>(() => ({ a: { b: 1 } }), { readOnly: ['a.b'] });

      expect(() => store.setState('a', undefined, { unmount: true })).toThrow(/read-only path "a"/);
      expect(store.getState().a).toEqual({ b: 1 });
    });

    it('throws for a grandparent write two levels above the read-only leaf', () => {
      type State = { a: { b: { c: number } } };
      const store = createStore<State>(() => ({ a: { b: { c: 1 } } }), { readOnly: ['a.b.c'] });

      expect(() => store.setState('a', { b: { c: 2 } })).toThrow(/read-only path "a"/);
    });
  });

  describe('modifying a descendant of a read-only path', () => {
    it('throws for a deep descendant of a single-segment read-only root', () => {
      const store = createStore<{ config: { theme: { shade: string } } }>(
        () => ({ config: { theme: { shade: 'light' } } }),
        { readOnly: ['config'] }
      );

      expect(() => store.setState('config.theme.shade', 'dark')).toThrow(/read-only path "config.theme.shade"/);
    });

    it('throws when unmounting a descendant of a read-only path', () => {
      type State = { config: { theme?: string } };
      const store = createStore<State>(() => ({ config: { theme: 'light' } }), { readOnly: ['config'] });

      expect(() => store.setState('config.theme', undefined, { unmount: true })).toThrow(
        /read-only path "config.theme"/
      );
    });
  });

  describe('edge cases: prefix collisions and siblings', () => {
    it('does not block a sibling key sharing the read-only prefix', () => {
      type State = { config: { theme: string; other: string } };
      const store = createStore<State>(() => ({ config: { theme: 'light', other: 'x' } }), {
        readOnly: ['config.theme']
      });

      store.setState('config.other', 'y');

      expect(store.getState().config.other).toBe('y');
    });

    it('does not treat a longer sibling name as a descendant (config vs configuration)', () => {
      const store = createStore<Record<string, unknown>>(() => ({ config: 1, configuration: 2 }), {
        readOnly: ['config']
      });

      store.setState('configuration', 9);

      expect(store.getState().configuration).toBe(9);
      expect(() => store.setState('config', 9)).toThrow(/read-only path "config"/);
    });

    it('does not treat a.bc as a descendant of read-only a.b', () => {
      type State = { a: { b: number; bc: number } };
      const store = createStore<State>(() => ({ a: { b: 1, bc: 2 } }), { readOnly: ['a.b'] });

      store.setState('a.bc', 9);

      expect(store.getState().a.bc).toBe(9);
      expect(() => store.setState('a.b', 9)).toThrow(/read-only path "a.b"/);
    });

    it('guards a specific array index without blocking its siblings', () => {
      const store = createStore<{ list: number[] }>(() => ({ list: [1, 2, 3] }), { readOnly: ['list.0'] });

      store.setState('list.1', 9);

      expect(store.getState().list).toEqual([1, 9, 3]);
      expect(() => store.setState('list.0', 9)).toThrow(/read-only path "list.0"/);
    });

    it('enforces every path when several are read-only', () => {
      type State = { a: number; b: { c: number }; d: number };
      const store = createStore<State>(() => ({ a: 1, b: { c: 2 }, d: 3 }), { readOnly: ['a', 'b.c'] });

      expect(() => store.setState('a', 9)).toThrow(/read-only path "a"/);
      expect(() => store.setState('b.c', 9)).toThrow(/read-only path "b.c"/);
      store.setState('d', 9);
      expect(store.getState().d).toBe(9);
    });
  });

  describe('edge cases: whole-state replaces use reference semantics', () => {
    it('blocks a replace that rebuilds an equal-but-new read-only object', () => {
      type State = { a: number; locked: { v: number } };
      const store = createStore<State>(() => ({ a: 1, locked: { v: 42 } }), { readOnly: ['locked'] });

      // Same value, new reference at `locked` — rejected, matching the store's reference-based change detection.
      expect(() => store.setState(undefined, { a: 2, locked: { v: 42 } })).toThrow(/read-only path "locked"/);
    });

    it('blocks a whole-state replace via the updater form when it touches a read-only path', () => {
      type State = { a: number; locked: number };
      const store = createStore<State>(() => ({ a: 1, locked: 42 }), { readOnly: ['locked'] });

      expect(() => store.setState(undefined, prev => ({ ...prev, locked: 99 }))).toThrow(/read-only path "locked"/);
      expect(store.getState().locked).toBe(42);
    });
  });

  describe('scope chain', () => {
    it('rejects a delegated child write via the readOnly on the parent', () => {
      type State = { locked: number };
      const parent = createStore<State>(() => ({ locked: 1 }), { readOnly: ['locked'] });
      const child = createStore<State>(() => ({}), { parent });

      expect(() => child.setState('locked', 2)).toThrow(/read-only path "locked"/);
      expect(parent.getState().locked).toBe(1);
    });

    it('does not apply a parent readOnly to a key the child owns locally', () => {
      type State = { value: number };
      const parent = createStore<State>(() => ({ value: 1 }), { readOnly: ['value'] });
      const child = createStore<State>(() => ({ value: 10 }), { parent });

      // The child structurally owns `value`, so its write stays local and the parent's readOnly never sees it.
      child.setState('value', 20);

      expect(child.getState().value).toBe(20);
      expect(parent.getState().value).toBe(1);
    });
  });
});
