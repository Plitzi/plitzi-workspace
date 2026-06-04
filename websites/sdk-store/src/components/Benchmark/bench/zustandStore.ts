import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { DEEP_MAP_TARGET, makeFlat, makeItemMap, makeNested, setLeaf, work, ZUSTAND } from './shared';

import type { DeepMapState, FlatState, Sample, NestedState, StoreAdapter } from './shared';

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

const deepMap = (items: number, updates: number): Sample => {
  const store = createStore<DeepMapState>()(subscribeWithSelector(() => makeItemMap(items)));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    const key = `i${i}`;
    store.subscribe(
      state => state.items[key].meta.n,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    const value = j + 1;
    store.setState(state => {
      const prev = state.items[DEEP_MAP_TARGET];

      return {
        items: { ...state.items, [DEEP_MAP_TARGET]: { ...prev, meta: { ...prev.meta, n: value } } }
      };
    });
  }

  return { name: ZUSTAND, wakes, ms: performance.now() - start };
};

const fanout = (keys: number, rounds: number): Sample => {
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
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < keys; i++) {
      store.setState({ [`k${i}`]: r + 1 });
    }
  }

  return { name: ZUSTAND, wakes, ms: performance.now() - start };
};

export const zustandAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout };
