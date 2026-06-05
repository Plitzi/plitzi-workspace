import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore';

import type { StoreChange } from './types';

// Edge cases and abuse: a user who doesn't read the docs and pokes the store in ways it wasn't designed for. The
// store must never crash or corrupt unrelated state.

type State = {
  count: number;
  user: { name: string; age: number };
  list: number[];
  flags: Record<string, boolean>;
};

const initial = (): State => ({
  count: 0,
  user: { name: 'Ada', age: 36 },
  list: [10, 20, 30],
  flags: { a: true }
});

describe('createStore — abuse & edge cases', () => {
  it('keeps state intact when an updater throws', () => {
    const store = createStore<State>(initial());

    expect(() =>
      store.setState('count', () => {
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(store.getState().count).toBe(0);
  });

  it('writes an explicit undefined without crashing', () => {
    const store = createStore<State>(initial());
    store.setState('count', undefined as never);

    expect(store.getState().count).toBeUndefined();
    expect('count' in store.getState()).toBe(true);
  });

  it('creates intermediate objects for a deep path on empty state', () => {
    const store = createStore<Record<string, unknown>>({});
    store.setState('a.b.c.d' as never, 1 as never);

    expect(store.getState()).toEqual({ a: { b: { c: { d: 1 } } } });
  });

  it('replaces a primitive when you write through it like an object', () => {
    const store = createStore<State>(initial());
    store.setState('count.foo' as never, 1 as never);

    expect(store.getState().count).toEqual({ foo: 1 });
  });

  it('preserves arrays on indexed writes (no array → object corruption)', () => {
    const store = createStore<State>(initial());
    store.setState('list.1' as never, 99 as never);

    const { list } = store.getState();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toEqual([10, 99, 30]);
  });

  it('preserves arrays on an indexed updater write', () => {
    const store = createStore<State>(initial());
    store.setState('list.0' as never, ((n: number) => n + 5) as never);

    expect(Array.isArray(store.getState().list)).toBe(true);
    expect(store.getState().list[0]).toBe(15);
  });

  it('returns undefined for missing paths instead of throwing', () => {
    const store = createStore<State>(initial());

    expect(store.getPath('user.middleName' as never)).toBeUndefined();
    expect(store.getPath('nope.deep.path' as never)).toBeUndefined();
  });

  it('skips the notification when the value does not actually change', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    store.subscribePath('count', () => wakes++);

    store.setState('count', 5);
    store.setState('count', 5);
    store.setState('count', 5);

    expect(wakes).toBe(1);
  });

  it('does not wake a path subscriber when a sibling changes', () => {
    const store = createStore<State>(initial());
    let nameWakes = 0;
    store.subscribePath('user.name', () => nameWakes++);

    store.setState('user.age', 40);

    expect(nameWakes).toBe(0);
  });

  it('survives a listener that unsubscribes itself during a notification', () => {
    const store = createStore<State>(initial());
    let selfCalls = 0;
    let otherCalls = 0;
    const unsub = store.subscribe(() => {
      selfCalls++;
      unsub();
    });
    store.subscribe(() => otherCalls++);

    expect(() => store.setState('count', 1)).not.toThrow();
    store.setState('count', 2);

    // The self-removing listener fired once and was gone for the second write.
    expect(selfCalls).toBe(1);
    expect(otherCalls).toBeGreaterThanOrEqual(1);
  });

  it('stores and reads a circular value without infinite-looping (root store)', () => {
    const store = createStore<Record<string, unknown>>({});
    const node: Record<string, unknown> = { label: 'x' };
    node.self = node;
    store.setState('node' as never, node as never);

    expect(store.getPath('node.self.self.label' as never)).toBe('x');
  });

  it('still serves getState after destroy()', () => {
    const store = createStore<State>(initial());
    store.setState('count', 7);
    store.destroy?.();

    expect(store.getState().count).toBe(7);
    expect(() => store.setState('count', 8)).not.toThrow();
  });

  it('handles a numeric-like top-level key', () => {
    const store = createStore<Record<string, unknown>>({});
    store.setState('123' as never, 'value' as never);

    expect(store.getState()).toEqual({ '123': 'value' });
  });
});

describe('createStore — batch abuse', () => {
  it('resets batch depth even when the batched fn throws, so later writes still notify', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    store.subscribe(() => wakes++);

    expect(() =>
      store.batch(() => {
        store.setState('count', 1);
        throw new Error('mid-batch');
      })
    ).toThrow('mid-batch');

    const wakesAfterThrow = wakes;
    store.setState('count', 2);

    expect(wakesAfterThrow).toBe(1); // the partial batch still flushed once
    expect(wakes).toBe(2); // and the store is not stuck in a batch
  });

  it('handles deeply nested batches, flushing once at the outermost', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    store.subscribe(() => wakes++);

    store.batch(() => {
      store.setState('count', 1);
      store.batch(() => {
        store.setState('count', 2);
        store.batch(() => store.setState('user.age', 99));
      });
    });

    expect(wakes).toBe(1);
    expect(store.getState().count).toBe(2);
    expect(store.getState().user.age).toBe(99);
  });
});

describe('scope chain — change forwarding to a child observer', () => {
  it('forwards a parent change to a child store change listener with merged state', () => {
    const parent = createStore<State>(initial());
    const child = createStore<State>({ count: 100 }, { parent });

    const changes: StoreChange<State>[] = [];
    child.subscribeChange(change => changes.push(change));

    parent.setState('user.name', 'Grace');

    expect(changes.length).toBeGreaterThanOrEqual(1);
    const last = changes[changes.length - 1];
    expect(last.next.user.name).toBe('Grace');
    expect(last.next.count).toBe(100); // child's own key still shadows
  });

  it('delegates a write of a non-owned key up to the parent', () => {
    const parent = createStore<State>(initial());
    const child = createStore<State>({ count: 100 }, { parent });

    child.setState('user.name', 'Linus');

    expect(parent.getState().user.name).toBe('Linus');
    expect(child.getState().user.name).toBe('Linus');
  });

  it('does not notify a destroyed child of later parent changes', () => {
    const parent = createStore<State>(initial());
    const child = createStore<State>({ count: 100 }, { parent });
    const listener = vi.fn();
    child.subscribe(listener);

    child.destroy?.();
    parent.setState('user.age', 50);

    expect(listener).not.toHaveBeenCalled();
  });
});
