import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/vanilla/utils';

import {
  DEEP_MAP_TARGET,
  makeFlat,
  makeItemMap,
  makeNested,
  makeRowArray,
  makeSelRowArray,
  makeSumValues,
  stridedIndices,
  sumValues,
  SUM_TARGET,
  VALTIO,
  work
} from './shared';

import type { DeepMapState, FlatState, NestedState, Row, Sample, SelRow, StoreAdapter, SumState } from './shared';

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

// Valtio has no vanilla memoized computed, so recompute the sum on each (synchronous) change and wake when it shifts.
const derived = (values: number, updates: number): Sample => {
  const state = proxy<SumState>(makeSumValues(values));
  let wakes = 0;
  let last = sumValues(state.values);
  subscribe(
    state,
    () => {
      const next = sumValues(state.values);
      if (next !== last) {
        last = next;
        wakes++;
        work(wakes);
      }
    },
    true
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.values[SUM_TARGET] = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

// Streaming feed — proxy rows mutated in place; subscribeKey watches one row's value, no map copy.
const liveFeed = (items: number, updates: number): Sample => {
  const state = proxy<Row[]>(makeRowArray(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    subscribeKey(
      state[i],
      'value',
      () => {
        wakes++;
        work(wakes);
      },
      true
    );
  }

  const plan = stridedIndices(items, updates);
  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state[plan[j]].value = j + 1;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

// Selection — a per-row `selected` flag mutated in place; a move flips exactly two.
const selection = (items: number, moves: number): Sample => {
  const state = proxy<SelRow[]>(makeSelRowArray(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    subscribeKey(
      state[i],
      'selected',
      () => {
        wakes++;
        work(wakes);
      },
      true
    );
  }

  let current = 0;
  const start = performance.now();
  for (let m = 1; m <= moves; m++) {
    const next = m % items;
    state[current].selected = false;
    state[next].selected = true;
    current = next;
  }

  return { name: VALTIO, wakes, ms: performance.now() - start };
};

export const valtioAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout, derived, liveFeed, selection };
