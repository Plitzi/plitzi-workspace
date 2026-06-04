import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/vanilla/utils';

import { DEEP_MAP_TARGET, makeFlat, makeItemMap, makeNested, VALTIO, work } from './shared';

import type { DeepMapState, FlatState, NestedState, Sample, StoreAdapter } from './shared';

// Valtio, proxy-based fine-grained: `subscribeKey` watches one property, `subscribe` watches one nested node.
// State is mutated in place through the proxy (no immutable copy). `notifyInSync` = true makes wakes synchronous
// so the benchmark measures them (Valtio batches on a microtask by default).
const wide = (keys: number, updates: number): Sample => {
  const state = proxy<FlatState>(makeFlat(keys));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    subscribeKey(
      state,
      `k${i}`,
      () => {
        wakes++;
        work(wakes);
      },
      true
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const state = proxy<FlatState>({ k0: 0 });
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    subscribeKey(
      state,
      'k0',
      () => {
        wakes++;
        work(wakes);
      },
      true
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  const state = proxy<NestedState>(makeNested());
  let wakes = 0;
  subscribe(
    state.a.b.c.d.e,
    () => {
      wakes++;
      work(wakes);
    },
    true
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.a.b.c.d.e.leaf = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const state = proxy<FlatState>(makeFlat(10));
  let wakes = 0;
  subscribeKey(
    state,
    'k0',
    () => {
      wakes++;
      work(wakes);
    },
    true
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

const deepMap = (items: number, updates: number): Sample => {
  const state = proxy<DeepMapState>(makeItemMap(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    subscribe(
      state.items[`i${i}`].meta,
      () => {
        wakes++;
        work(wakes);
      },
      true
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.items[DEEP_MAP_TARGET].meta.n = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

const fanout = (keys: number, rounds: number): Sample => {
  const state = proxy<FlatState>(makeFlat(keys));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    subscribeKey(
      state,
      `k${i}`,
      () => {
        wakes++;
        work(wakes);
      },
      true
    );
  }

  const start = performance.now();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < keys; i++) {
      state[`k${i}`] = r + 1;
    }
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

export const valtioAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout };
