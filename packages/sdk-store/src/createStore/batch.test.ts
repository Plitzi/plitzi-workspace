import { describe, it, expect } from 'vitest';

import createStore from './createStore';

import type { StoreChange } from '../types';

type State = { a: number; b: number; user: { name: string; age: number } };
const initial = (): State => ({ a: 0, b: 0, user: { name: 'ada', age: 30 } });

describe('store.batch', () => {
  it('wakes a subscriber once for many writes instead of once per write', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    store.subscribe(() => wakes++);

    store.batch(() => {
      store.setState('a', 1);
      store.setState('a', 2);
      store.setState('b', 5);
    });

    expect(wakes).toBe(1);
    expect(store.getState()).toMatchObject({ a: 2, b: 5 });
  });

  it('applies writes immediately so reads inside the batch see them', () => {
    const store = createStore<State>(initial());
    const seen: number[] = [];

    store.batch(() => {
      store.setState('a', 1);
      seen.push(store.getState().a);
      store.setState('a', store.getState().a + 10);
      seen.push(store.getState().a);
    });

    expect(seen).toEqual([1, 11]);
  });

  it('dedupes a subscriber registered on two paths that both change', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    const cb = () => wakes++;
    store.subscribePath('a', cb);
    store.subscribePath('b', cb);

    store.batch(() => {
      store.setState('a', 1);
      store.setState('b', 2);
    });

    expect(wakes).toBe(1);
  });

  it('does not wake a path subscriber whose value did not change', () => {
    const store = createStore<State>(initial());
    let aWakes = 0;
    let bWakes = 0;
    store.subscribePath('a', () => aWakes++);
    store.subscribePath('b', () => bWakes++);

    store.batch(() => {
      store.setState('a', 1);
    });

    expect(aWakes).toBe(1);
    expect(bWakes).toBe(0);
  });

  it('flushes only at the outermost batch when nested', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    store.subscribe(() => wakes++);

    store.batch(() => {
      store.setState('a', 1);
      store.batch(() => {
        store.setState('b', 2);
      });

      expect(wakes).toBe(0);
    });

    expect(wakes).toBe(1);
  });

  it('returns the value produced by the batched function', () => {
    const store = createStore<State>(initial());
    const result = store.batch(() => {
      store.setState('a', 7);

      return store.getState().a * 2;
    });

    expect(result).toBe(14);
  });

  it('still flushes pending wakes when the batched function throws', () => {
    const store = createStore<State>(initial());
    let wakes = 0;
    store.subscribe(() => wakes++);

    expect(() =>
      store.batch(() => {
        store.setState('a', 1);
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(wakes).toBe(1);
    expect(store.getState().a).toBe(1);
  });

  it('lets change observers (logger/history/persist) see each write, not a coalesced one', () => {
    const changes: StoreChange<State>[] = [];
    const store = createStore<State>(initial());
    store.subscribeChange(change => changes.push(change));

    store.batch(() => {
      store.setState('a', 1);
      store.setState('b', 2);
    });

    expect(changes.map(c => c.path)).toEqual(['a', 'b']);
  });

  it('coalesces wakes across a nested-path write and a single-segment write', () => {
    const store = createStore<State>(initial());
    let userWakes = 0;
    store.subscribePath('user.name', () => userWakes++);

    store.batch(() => {
      store.setState('user.name', 'grace');
      store.setState('user.age', 31);
    });

    expect(userWakes).toBe(1);
    expect(store.getState().user).toEqual({ name: 'grace', age: 31 });
  });
});
