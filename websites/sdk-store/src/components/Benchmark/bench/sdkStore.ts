import { createStore } from '@plitzi/sdk-store';

import { DEEP_MAP_TARGET, makeFlat, makeItemMap, makeNested, SDK, work } from './shared';

import type { DeepMapState, FlatState, Sample, NestedState, StoreAdapter } from './shared';

const wide = (keys: number, updates: number): Sample => {
  const store = createStore<FlatState>(makeFlat(keys));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    store.subscribePath(`k${i}`, () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState('k0', j + 1);
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const store = createStore<FlatState>({ k0: 0 });
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    store.subscribePath('k0', () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState('k0', j + 1);
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  const store = createStore<NestedState>(makeNested());
  let wakes = 0;
  store.subscribePath('a.b.c.d.e.leaf', () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState('a.b.c.d.e.leaf', j + 1);
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const store = createStore<FlatState>(makeFlat(10));
  let wakes = 0;
  store.subscribePath('k0', () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState('k0', j + 1);
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

const deepMap = (items: number, updates: number): Sample => {
  const store = createStore<DeepMapState>(makeItemMap(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    store.subscribePath(`items.i${i}.meta.n`, () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState(`items.${DEEP_MAP_TARGET}.meta.n`, j + 1);
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

const fanout = (keys: number, rounds: number): Sample => {
  const store = createStore<FlatState>(makeFlat(keys));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    store.subscribePath(`k${i}`, () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < keys; i++) {
      store.setState(`k${i}`, r + 1);
    }
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

export const sdkAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout };
