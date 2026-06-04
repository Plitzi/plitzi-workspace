import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { makeFlat, makeNested, setLeaf, work, ZUSTAND } from './shared';

import type { FlatState, Sample, NestedState, StoreAdapter } from './shared';

// Zustand used the fine-grained way: subscribeWithSelector, one selector per watched value.
const wide = (keys: number, updates: number): Sample => {
  const store = createStore<FlatState>()(subscribeWithSelector(() => makeFlat(keys)));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    const key = `k${i}`;
    store.subscribe(
      state => state[key],
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState({ k0: j + 1 });
  }

  return { name: ZUSTAND, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const store = createStore<{ k0: number }>()(subscribeWithSelector(() => ({ k0: 0 })));
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    store.subscribe(
      state => state.k0,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState({ k0: j + 1 });
  }

  return { name: ZUSTAND, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  const store = createStore<NestedState>()(subscribeWithSelector(() => makeNested()));
  let wakes = 0;
  store.subscribe(
    state => state.a.b.c.d.e.leaf,
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState(setLeaf(store.getState(), j + 1));
  }

  return { name: ZUSTAND, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const store = createStore<FlatState>()(subscribeWithSelector(() => makeFlat(10)));
  let wakes = 0;
  store.subscribe(
    state => state.k0,
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState({ k0: j + 1 });
  }

  return { name: ZUSTAND, wakes, ms: performance.now() - start };
};

export const zustandAdapter: StoreAdapter = { wide, hot, nested, churn };
