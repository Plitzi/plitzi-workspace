import { describe, it, expect, vi } from 'vitest';

import { getStoreHistory, historyMiddleware } from './historyMiddleware';
import createStore from '../createStore';

import type { StoreHistory, StoreHistoryOptions } from './historyMiddleware';
import type { StoreApi } from '../types';

type S = { count: number; label: string };

const enableHistory = <T extends object>(store: StoreApi<T>): StoreHistory<T> => {
  const history = getStoreHistory<T>(store);
  if (!history) {
    throw new Error('history not registered');
  }

  return history;
};

const make = (options?: StoreHistoryOptions) => {
  const store = createStore<S>({ count: 0, label: 'a' }, { middlewares: [historyMiddleware<S>(options)] });

  return { store, history: enableHistory(store) };
};

describe('historyMiddleware: action log', () => {
  it('starts with the initial snapshot', () => {
    const { history } = make();
    const snap = history.getSnapshot();

    expect(snap.entries).toHaveLength(1);
    expect(snap.index).toBe(0);
    expect(snap.canUndo).toBe(false);
    expect(snap.canRedo).toBe(false);
  });

  it('records each change with the changed path and advances the index', () => {
    const { store, history } = make();

    store.setState('count', 1);
    store.setState('label', 'b');

    const snap = history.getSnapshot();
    expect(snap.entries).toHaveLength(3);
    expect(snap.index).toBe(2);
    expect(snap.entries[1].path).toBe('count');
    expect(snap.entries[2].path).toBe('label');
  });

  it('notifies subscribers and exposes a stable snapshot between changes', () => {
    const { store, history } = make();
    const listener = vi.fn();
    history.subscribe(listener);

    const before = history.getSnapshot();
    expect(history.getSnapshot()).toBe(before); // stable ref while unchanged

    store.setState('count', 5);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(history.getSnapshot()).not.toBe(before);
  });

  it('honors `shouldRecord` to skip noisy paths', () => {
    type Noisy = { a: number; runtime: { x: number } };
    const store = createStore<Noisy>(
      { a: 0, runtime: { x: 0 } },
      { middlewares: [historyMiddleware<Noisy>({ shouldRecord: path => !path?.startsWith('runtime.') })] }
    );
    const history = enableHistory(store);

    store.setState('runtime.x', 1);
    store.setState('a', 1);

    const snap = history.getSnapshot();
    expect(snap.entries).toHaveLength(2); // initial + `a` only
    expect(snap.entries[1].path).toBe('a');
  });

  it('caps the log at `limit` (ring buffer)', () => {
    const { store, history } = make({ limit: 3 });

    for (let i = 1; i <= 10; i++) {
      store.setState('count', i);
    }

    expect(history.getSnapshot().entries).toHaveLength(3);
  });
});

describe('historyMiddleware: time-travel', () => {
  it('undo/redo move the index and restore the store state', () => {
    const { store, history } = make();

    store.setState('count', 1);
    store.setState('count', 2);
    expect(store.getState().count).toBe(2);

    history.undo();
    expect(store.getState().count).toBe(1);
    expect(history.getSnapshot().index).toBe(1);

    history.undo();
    expect(store.getState().count).toBe(0);
    expect(history.getSnapshot().canUndo).toBe(false);

    history.redo();
    expect(store.getState().count).toBe(1);
  });

  it('travelTo restores an arbitrary snapshot without recording the travel', () => {
    const { store, history } = make();
    store.setState('count', 1);
    store.setState('count', 2);
    store.setState('count', 3);

    const lengthBefore = history.getSnapshot().entries.length;
    history.travelTo(1);

    expect(store.getState().count).toBe(1);
    expect(history.getSnapshot().entries).toHaveLength(lengthBefore); // travel is not a new entry
  });

  it('discards the redo branch when a new change follows an undo', () => {
    const { store, history } = make();
    store.setState('count', 1);
    store.setState('count', 2);

    history.undo(); // back to count = 1 (index 1)
    store.setState('count', 9); // new branch

    const snap = history.getSnapshot();
    expect(snap.entries).toHaveLength(3); // initial, count=1, count=9
    expect(snap.canRedo).toBe(false);
    expect(store.getState().count).toBe(9);
  });

  it('clear resets to the current state', () => {
    const { store, history } = make();
    store.setState('count', 1);
    store.setState('count', 2);

    history.clear();

    const snap = history.getSnapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.index).toBe(0);
    expect(snap.entries[0].state.count).toBe(2);
  });
});

describe('getStoreHistory', () => {
  it('returns the same registered history instance per store', () => {
    const store = createStore<S>({ count: 0, label: 'a' }, { middlewares: [historyMiddleware<S>()] });

    expect(getStoreHistory(store)).toBe(getStoreHistory(store));
  });

  it('returns undefined for a store with no historyMiddleware', () => {
    const store = createStore<S>({ count: 0, label: 'a' });

    expect(getStoreHistory(store)).toBeUndefined();
  });
});
