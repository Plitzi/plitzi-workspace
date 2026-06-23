import { describe, it, expect } from 'vitest';
import { effectScope, nextTick } from 'vue';

import { useDerived } from './useDerived';
import { useEntityIds, useEntityOne } from './useEntity';
import { useStore, useStoreValue } from './useStore';
import { useStoreHistory } from './useStoreHistory';
import createStore from '../createStore/createStore';
import { createDerived } from '../derived/createDerived';
import { createEntityStore } from '../entities/createEntityStore';
import { historyMiddleware } from '../middleware/historyMiddleware';

import type { StoreApi } from '../types';

type State = { count: number; user: { name: string } };

const run = <T>(fn: () => T): { result: T; scope: ReturnType<typeof effectScope> } => {
  const scope = effectScope();
  const result = scope.run(fn) as T;

  return { result, scope };
};

describe('@plitzi/nexus/vue', () => {
  it('useStoreValue reflects a path and updates on change', () => {
    const store = createStore<State>({ count: 1, user: { name: 'Ada' } });
    const { result: count, scope } = run(() => useStoreValue('count', { store }));

    expect(count.value).toBe(1);
    store.set('count', 5);
    expect(count.value).toBe(5);

    scope.stop();
    store.set('count', 9);
    expect(count.value).toBe(5); // unsubscribed on scope dispose
  });

  it('useStoreValue with no path tracks the whole state', () => {
    const store = createStore<State>({ count: 1, user: { name: 'Ada' } });
    const { result: state } = run(() => useStoreValue<State>({ store }));

    expect(state.value.count).toBe(1);
    store.set('count', 2);
    expect(state.value.count).toBe(2);
  });

  it('useStore is a two-way binding', () => {
    const store = createStore<State>({ count: 1, user: { name: 'Ada' } });
    const { result: count } = run(() => useStore('count', { store }));

    count.value = 42;
    expect(store.get('count')).toBe(42);
    store.set('count', 7);
    expect(count.value).toBe(7);
  });

  it('useEntityOne / useEntityIds are reactive', () => {
    const store = createEntityStore<{ id: string; v: number }>([{ id: 'a', v: 1 }]);
    const { result } = run(() => ({ one: useEntityOne(store, 'a'), ids: useEntityIds(store) }));

    expect(result.one.value).toEqual({ id: 'a', v: 1 });
    expect(result.ids.value).toEqual(['a']);

    store.updateOne('a', { v: 2 });
    expect(result.one.value).toEqual({ id: 'a', v: 2 });

    store.addOne({ id: 'b', v: 3 });
    expect(result.ids.value).toEqual(['a', 'b']);
  });

  it('useDerived recomputes on dependency change', () => {
    const store = createStore<State>({ count: 2, user: { name: 'Ada' } });
    const doubled = createDerived(store, ['count'], ([c]) => c * 2);
    const { result: d } = run(() => useDerived(doubled));

    expect(d.value).toBe(4);
    store.set('count', 5);
    expect(d.value).toBe(10);
  });

  it('useStoreHistory exposes undo/redo over historyMiddleware', () => {
    const store: StoreApi<State> = createStore<State>(() => ({ count: 0, user: { name: 'Ada' } }), {
      middlewares: [historyMiddleware()]
    });
    const { result: history } = run(() => useStoreHistory({ store }));

    store.set('count', 1);
    store.set('count', 2);
    expect(history.value.canUndo).toBe(true);

    history.value.undo();
    expect(store.get('count')).toBe(1);
  });

  it('does not require a DOM (headless reactivity)', async () => {
    const store = createStore<State>({ count: 0, user: { name: 'Ada' } });
    const { result: count } = run(() => useStoreValue('count', { store }));
    store.set('count', 3);
    await nextTick();
    expect(count.value).toBe(3);
  });
});
