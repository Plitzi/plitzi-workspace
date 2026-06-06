import { describe, it, expect } from 'vitest';

import createStore from './createStore';

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

describe('store survival — attacks that should not crash or corrupt', () => {
  it('does not infinite-loop when a listener writes to a new key on each call (self-terminating via unsub)', () => {
    const store = createStore<Record<string, number>>({});
    let callCount = 0;
    const maxCalls = 1000;

    const unsub = store.subscribe(() => {
      callCount++;
      if (callCount < maxCalls) {
        store.setState(String(callCount) as never, callCount as never);
      } else {
        unsub();
      }
    });

    store.setState('start' as never, 0 as never);

    // Exactly maxCalls because: initialization triggers 1, plus each of the (maxCalls-1) recursive
    // writes triggers one more. The unsub at maxCutsIt stops any further notification.
    expect(callCount).toBe(maxCalls);
  });

  it('terminates after 2 calls when a listener writes back the original value (value oscillates once)', () => {
    const store = createStore<State>(initial());

    let callCount = 0;
    store.subscribePath('count', () => {
      callCount++;
      // Write back the original value — this is a real change (1 → 0),
      // but the second write (0 → 0) is deduplicated
      store.setState('count', 0);
    });

    store.setState('count', 1);

    // Listener fires: 0→1 (mutation), then 1→0 (recursive write), then 0→0 deduped → stops
    expect(callCount).toBe(2);
  });

  it('survives writing through a frozen intermediate object', () => {
    const store = createStore<Record<string, unknown>>({});
    store.setState('a' as never, Object.freeze({ b: { c: 1 } }) as never);

    // Write through the frozen node — it should clone, not mutate in place
    expect(() => store.setState('a.b.c' as never, 2 as never)).not.toThrow();

    expect(store.getState()).toEqual({ a: { b: { c: 2 } } });
  });

  it('survives a very deep state tree without stack overflow', () => {
    const store = createStore<Record<string, unknown>>({});
    const path = new Array(100)
      .fill(null)
      .map((_, i) => `lvl${i}`)
      .join('.');

    expect(() => store.setState(path as never, 'deep' as never)).not.toThrow();
    expect(store.getState()).toBeDefined();

    const deepValue = new Array(100)
      .fill(null)
      .reduce<Record<string, unknown>>((obj, _, i) => obj[`lvl${i}`] as Record<string, unknown>, store.getState());
    expect(deepValue).toBe('deep');
  });

  it('survives reading back a very deep state tree (100 levels) without stack overflow', () => {
    const store = createStore<Record<string, unknown>>({});
    const path = new Array(100)
      .fill(null)
      .map((_, i) => `lvl${i}`)
      .join('.');

    store.setState(path as never, 'deep' as never);

    expect(() => store.getPath(path as never)).not.toThrow();
    expect(store.getPath(path as never)).toBe('deep');
  });

  it('does not leak memory when subscribing and unsubscribing many unique paths', () => {
    const store = createStore<Record<string, number>>({});
    const unsubs: (() => void)[] = [];
    const count = 1000;

    for (let i = 0; i < count; i++) {
      unsubs.push(store.subscribePath(String(i) as never, () => {}));
    }

    // Assert they all fire
    let total = 0;
    const unsub2 = store.subscribePath('999' as never, () => total++);
    store.setState('999' as never, 1 as never);
    expect(total).toBe(1);
    unsub2();

    // Unsubscribe all
    for (const unsub of unsubs) {
      unsub();
    }

    // After unsubscription, no more notifications
    store.setState('999' as never, 2 as never);
    expect(total).toBe(1);
  });
});
