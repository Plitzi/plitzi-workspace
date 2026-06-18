import { createDerived, createEntityStore, createStore } from '@plitzi/nexus';

import {
  DEEP_MAP_TARGET,
  makeFlat,
  makeNested,
  makeRowArray,
  makeSelRowArray,
  makeSumValues,
  SDK,
  stridedIndices,
  sumValues,
  SUM_TARGET,
  work
} from './shared';

import type { FlatState, Item, Row, Sample, NestedState, SelRow, StoreAdapter, SumState } from './shared';

type EntityItem = Item & { id: string };

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

// Normalized data is what `createEntityStore` is for: a per-id reactive collection where a single-item write is O(1)
// and wakes only that item's watcher — instead of `setState` copying the whole 2,000-entry map on every edit.
const deepMap = (items: number, updates: number): Sample => {
  const seed: EntityItem[] = [];
  for (let i = 0; i < items; i++) {
    seed.push({ id: `i${i}`, value: 0, meta: { tag: 'el', n: 0 } });
  }

  const store = createEntityStore<EntityItem>(seed);
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    store.subscribeOne(`i${i}`, () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.updateOne(DEEP_MAP_TARGET, { meta: { tag: 'el', n: j + 1 } });
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

const derived = (values: number, updates: number): Sample => {
  const store = createStore<SumState>(makeSumValues(values));
  const total = createDerived(store, ['values'], ([v]) => sumValues(v));
  let wakes = 0;
  total.subscribe(() => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.setState(`values.${SUM_TARGET}`, j + 1);
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

// Streaming feed — createEntityStore: each write touches one row (O(1)) and wakes only that row's watcher.
const liveFeed = (items: number, updates: number): Sample => {
  const store = createEntityStore<Row>(makeRowArray(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    store.subscribeOne(`r${i}`, () => {
      wakes++;
      work(wakes);
    });
  }

  const plan = stridedIndices(items, updates);
  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.updateOne(`r${plan[j]}`, { value: j + 1 });
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

// Selection — a per-item `selected` flag on createEntityStore: a move flips exactly two rows, waking only those two.
const selection = (items: number, moves: number): Sample => {
  const store = createEntityStore<SelRow>(makeSelRowArray(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    store.subscribeOne(`r${i}`, () => {
      wakes++;
      work(wakes);
    });
  }

  let current = 0;
  const start = performance.now();
  for (let m = 1; m <= moves; m++) {
    const next = m % items;
    store.batch(() => {
      store.updateOne(`r${current}`, { selected: false });
      store.updateOne(`r${next}`, { selected: true });
    });
    current = next;
  }

  return { name: SDK, wakes, ms: performance.now() - start };
};

export const sdkAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout, derived, liveFeed, selection };
