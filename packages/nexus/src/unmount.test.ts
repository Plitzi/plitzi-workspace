import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore/createStore';
import { CANCEL } from './types';

import type { StoreChange } from './types';

describe('setState unmount', () => {
  describe('single-segment', () => {
    it('removes the key entirely instead of leaving it undefined', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1, b: 2 }));

      store.setState('a', undefined, { unmount: true });

      expect(store.getState()).toEqual({ b: 2 });
      expect(Object.hasOwn(store.getState(), 'a')).toBe(false);
      expect(Object.keys(store.getState())).toEqual(['b']);
    });

    it('is a no-op when the key is absent (no change emitted)', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));
      const prev = store.getState();
      const onChange = vi.fn();
      store.subscribeChange(onChange);

      store.setState('missing', undefined, { unmount: true });

      expect(store.getState()).toBe(prev);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('leaves no dead entry for Object.values consumers', () => {
      const store = createStore<Record<string, { id: string } | undefined>>(() => ({
        s1: { id: 's1' },
        s2: { id: 's2' }
      }));

      store.setState('s1', undefined, { unmount: true });

      expect(Object.values(store.getState())).toEqual([{ id: 's2' }]);
      expect(Object.values(store.getState()).some(v => v === undefined)).toBe(false);
    });
  });

  describe('multi-segment', () => {
    it('removes a nested leaf and keeps its siblings', () => {
      const store = createStore<{ a: { b?: number; c: number } }>(() => ({ a: { b: 1, c: 2 } }));

      store.setState('a.b', undefined, { unmount: true });

      expect(store.getState()).toEqual({ a: { c: 2 } });
      expect(Object.hasOwn(store.getState().a, 'b')).toBe(false);
    });

    it('shares untouched subtrees (structural sharing)', () => {
      const store = createStore<{ a: { b?: number }; other: { x: number } }>(() => ({
        a: { b: 1 },
        other: { x: 1 }
      }));
      const before = store.getState();

      store.setState('a.b', undefined, { unmount: true });
      const after = store.getState();

      expect(after).not.toBe(before);
      expect(after.a).not.toBe(before.a);
      expect(after.other).toBe(before.other);
    });

    it('is a no-op when an intermediate container is absent', () => {
      const store = createStore<{ a?: { b?: number } }>(() => ({}));
      const prev = store.getState();

      store.setState('a.b', undefined, { unmount: true });

      expect(store.getState()).toBe(prev);
    });

    it('splices an array index out rather than leaving a hole', () => {
      const store = createStore<{ list: Array<number | undefined> }>(() => ({ list: [10, 20, 30] }));

      store.setState('list.1', undefined, { unmount: true });

      expect(store.getState().list).toEqual([10, 30]);
      expect(Array.isArray(store.getState().list)).toBe(true);
    });
  });

  describe('notifications', () => {
    it('emits a change with the old value going to undefined', () => {
      const store = createStore<{ a: { b?: number } }>(() => ({ a: { b: 5 } }));
      const changes: StoreChange<{ a: { b?: number } }>[] = [];
      store.subscribeChange(c => changes.push(c));

      store.setState('a.b', undefined, { unmount: true });

      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('a.b');
      expect(changes[0].prevValue).toBe(5);
      expect(changes[0].nextValue).toBeUndefined();
    });

    it('wakes a path subscriber on the removed path', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));
      const listener = vi.fn();
      store.subscribePath('a', listener);

      store.setState('a', undefined, { unmount: true });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not wake subscribers when canPropagate is false', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));
      const listener = vi.fn();
      store.subscribePath('a', listener);

      store.setState('a', undefined, { unmount: true, canPropagate: false });

      expect(Object.hasOwn(store.getState(), 'a')).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('interceptors', () => {
    it('lets a beforeChange interceptor veto the removal', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }), {
        middlewares: [() => ({ beforeChange: ({ path }) => (path === 'a' ? CANCEL : undefined) })]
      });

      store.setState('a', undefined, { unmount: true });

      expect(store.getState()).toEqual({ a: 1 });
    });
  });

  describe('scoped stores', () => {
    it('delegates an unmount up to the owning parent (source registry pattern)', () => {
      type State = { sources: Record<string, { id: string } | undefined> };
      const parent = createStore<State>(() => ({ sources: { s1: { id: 's1' } } }));
      const child = createStore<State>(() => ({}), { parent });

      child.setState('sources.s1', undefined, { unmount: true });

      expect(Object.hasOwn(parent.getState().sources, 's1')).toBe(false);
      expect(parent.getState().sources).toEqual({});
    });
  });

  describe('options object', () => {
    it('honors canPropagate: false alongside a normal write', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));
      const listener = vi.fn();
      store.subscribePath('a', listener);

      store.setState('a', 2, { canPropagate: false });

      expect(store.getState().a).toBe(2);
      expect(listener).not.toHaveBeenCalled();
    });

    it('ignores unmount for a whole-state write (path undefined)', () => {
      const store = createStore<{ a: number; b: number }>(() => ({ a: 1, b: 2 }));

      store.setState(undefined, { a: 9, b: 8 }, { unmount: true });

      expect(store.getState()).toEqual({ a: 9, b: 8 });
    });
  });

  describe('re-adding a value after unmount', () => {
    it('recreates a single-segment key removed by unmount', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));

      store.setState('a', undefined, { unmount: true });
      expect(Object.hasOwn(store.getState(), 'a')).toBe(false);

      store.setState('a', 5);

      expect(store.getState().a).toBe(5);
      expect(Object.hasOwn(store.getState(), 'a')).toBe(true);
    });

    it('recreates a nested leaf removed by unmount, keeping siblings', () => {
      const store = createStore<{ a: { b?: number; c: number } }>(() => ({ a: { b: 1, c: 2 } }));

      store.setState('a.b', undefined, { unmount: true });
      store.setState('a.b', 9);

      expect(store.getState().a).toEqual({ b: 9, c: 2 });
    });

    it('rebuilds an intermediate container that unmount had emptied', () => {
      const store = createStore<{ a?: { b?: number } }>(() => ({ a: { b: 1 } }));

      store.setState('a.b', undefined, { unmount: true });
      expect(store.getState().a).toEqual({});

      store.setState('a.b', 42);

      expect(store.getState().a).toEqual({ b: 42 });
    });

    it('feeds the updater an undefined prev after unmount when re-adding', () => {
      const store = createStore<{ a?: number }>(() => ({ a: 10 }));

      store.setState('a', undefined, { unmount: true });
      store.setState('a', prev => (prev ?? 0) + 1);

      expect(store.getState().a).toBe(1);
    });

    it('wakes a path subscriber on both the unmount and the re-add', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));
      const listener = vi.fn();
      store.subscribePath('a', listener);

      store.setState('a', undefined, { unmount: true });
      store.setState('a', 2);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(store.getState().a).toBe(2);
    });

    it('emits a change from undefined back to the new value on re-add', () => {
      const store = createStore<{ a: { b?: number } }>(() => ({ a: { b: 5 } }));
      const changes: StoreChange<{ a: { b?: number } }>[] = [];

      store.setState('a.b', undefined, { unmount: true });
      store.subscribeChange(c => changes.push(c));
      store.setState('a.b', 7);

      expect(changes).toHaveLength(1);
      expect(changes[0].prevValue).toBeUndefined();
      expect(changes[0].nextValue).toBe(7);
    });

    it('supports a full unmount → re-add lifecycle on the source registry pattern', () => {
      type State = { sources: Record<string, { id: string } | undefined> };
      const store = createStore<State>(() => ({ sources: {} }));

      store.setState('sources.s1', { id: 's1' });
      store.setState('sources.s1', undefined, { unmount: true });
      expect(store.getState().sources).toEqual({});

      store.setState('sources.s1', { id: 's1-again' });

      expect(store.getState().sources).toEqual({ s1: { id: 's1-again' } });
      expect(Object.values(store.getState().sources).some(v => v === undefined)).toBe(false);
    });

    it('re-adds through the scope chain: delegated unmount then delegated write both hit the parent', () => {
      type State = { sources: Record<string, { id: string } | undefined> };
      const parent = createStore<State>(() => ({ sources: {} }));
      const child = createStore<State>(() => ({}), { parent });

      child.setState('sources.s1', { id: 's1' });
      child.setState('sources.s1', undefined, { unmount: true });
      child.setState('sources.s2', { id: 's2' });

      expect(parent.getState().sources).toEqual({ s2: { id: 's2' } });
      expect(child.getState().sources).toEqual({ s2: { id: 's2' } });
    });
  });

  describe('idempotence', () => {
    it('is a no-op the second time a key is unmounted', () => {
      const store = createStore<Record<string, unknown>>(() => ({ a: 1 }));
      const onChange = vi.fn();

      store.setState('a', undefined, { unmount: true });
      store.subscribeChange(onChange);
      store.setState('a', undefined, { unmount: true });

      expect(onChange).not.toHaveBeenCalled();
      expect(Object.hasOwn(store.getState(), 'a')).toBe(false);
    });
  });
});
