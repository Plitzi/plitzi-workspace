import { describe, it, expect } from 'vitest';

import { createStoreHistory, getStoreHistory } from './createStoreHistory';
import createStore from '../createStore/createStore';

type S = { count: number; schema: { title: string }; other: number };
const initial = (): S => ({ count: 0, schema: { title: 'a' }, other: 1 });

describe('createStoreHistory — edge cases', () => {
  it('caps the log at `limit` (ring buffer, oldest dropped)', () => {
    const store = createStore<S>(initial());
    const history = createStoreHistory(store, { limit: 3 });

    for (let i = 1; i <= 5; i++) {
      store.setState('count', i);
    }

    expect(history.getSnapshot().entries.length).toBe(3);
    expect(store.getState().count).toBe(5);
  });

  it('discards the redo branch when a new change follows an undo', () => {
    const store = createStore<S>(initial());
    const history = createStoreHistory(store);

    store.setState('count', 1);
    store.setState('count', 2);
    history.undo();
    expect(store.getState().count).toBe(1);

    store.setState('count', 9);

    expect(history.getSnapshot().canRedo).toBe(false);
    expect(store.getState().count).toBe(9);
  });

  it('ignores out-of-range travelTo targets', () => {
    const store = createStore<S>(initial());
    const history = createStoreHistory(store);
    store.setState('count', 1);

    history.travelTo(-1);
    history.travelTo(99);

    expect(store.getState().count).toBe(1);
    expect(history.getSnapshot().index).toBe(1);
  });

  it('respects a shouldRecord filter', () => {
    const store = createStore<S>(initial());
    const history = createStoreHistory(store, { shouldRecord: changed => changed !== 'count' });

    store.setState('count', 1);
    expect(history.getSnapshot().entries.length).toBe(1);

    store.setState('schema.title', 'b');
    expect(history.getSnapshot().entries.length).toBe(2);
  });

  it('scopes recording and restoration to a root path', () => {
    const store = createStore<S>(initial());
    const history = createStoreHistory(store, { path: 'schema' });

    store.setState('other', 50); // outside the scope → not recorded
    expect(history.getSnapshot().entries.length).toBe(1);

    store.setState('schema.title', 'b');
    expect(history.getSnapshot().entries.length).toBe(2);

    history.travelTo(0); // restores only the schema subtree
    expect(store.getState().schema.title).toBe('a');
    expect(store.getState().other).toBe(50);
  });

  it('refines a coarse change to the exact leaf path and value', () => {
    const store = createStore<{ a: { b: { c: number } } }>({ a: { b: { c: 1 } } });
    const history = createStoreHistory(store);

    store.setState('a', { b: { c: 2 } });

    const entries = history.getSnapshot().entries;
    const last = entries[entries.length - 1];
    expect(last.path).toBe('a.b.c');
    expect(last.value).toBe(2);
  });

  it('stops recording after destroy', () => {
    const store = createStore<S>(initial());
    const history = createStoreHistory(store);
    history.destroy();

    store.setState('count', 1);
    expect(history.getSnapshot().entries.length).toBe(1);
  });
});

describe('getStoreHistory', () => {
  it('returns one shared instance per store', () => {
    const store = createStore<S>(initial());

    expect(getStoreHistory(store)).toBe(getStoreHistory(store));
  });
});
