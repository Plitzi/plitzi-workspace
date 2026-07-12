import { describe, it, expect, vi } from 'vitest';

import createStore from './createStore/createStore';
import { getDevStoresSnapshot, registerDevStore, subscribeDevStores } from './devStoreRegistry';

const hasStore = (store: unknown) => getDevStoresSnapshot().some(entry => entry.store === store);

describe('devStoreRegistry', () => {
  it('adds and removes a store from the snapshot', () => {
    const store = createStore(() => ({ a: 1 }));
    expect(hasStore(store)).toBe(false);

    const unregister = registerDevStore(store);
    expect(hasStore(store)).toBe(true);

    unregister();
    expect(hasStore(store)).toBe(false);
  });

  it('keeps the scope tag on the entry', () => {
    const store = createStore(() => ({ a: 1 }));
    const unregister = registerDevStore(store, 'instance-42');

    const entry = getDevStoresSnapshot().find(candidate => (candidate.store as unknown) === store);
    expect(entry?.scopeId).toBe('instance-42');
    expect(entry?.uid).toBeTruthy();

    unregister();
  });

  it('notifies subscribers on register and unregister', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDevStores(listener);

    const unregister = registerDevStore(createStore(() => ({ a: 1 })));
    expect(listener).toHaveBeenCalledTimes(1);

    unregister();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    registerDevStore(createStore(() => ({ b: 2 })))();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a stable snapshot reference between mutations', () => {
    const before = getDevStoresSnapshot();
    const after = getDevStoresSnapshot();
    expect(after).toBe(before);

    const unregister = registerDevStore(createStore(() => ({ a: 1 })));
    expect(getDevStoresSnapshot()).not.toBe(before);
    unregister();
  });
});
