import { computed, configure, observable, reaction } from 'mobx';

import {
  DEEP_MAP_TARGET,
  makeFlat,
  makeItemMap,
  makeNested,
  makeSumValues,
  MOBX,
  sumValues,
  SUM_TARGET,
  work
} from './shared';

import type { DeepMapState, FlatState, NestedState, Sample, StoreAdapter, SumState } from './shared';

// MobX, fine-grained by design: one `reaction` per watched value re-runs only when that value changes. State is a
// deeply observable object mutated in place (no immutable copy) — its strength on writes, paid for with proxy
// bookkeeping when the observable graph is built.
configure({ enforceActions: 'never' });

const wide = (keys: number, updates: number): Sample => {
  const state = observable<FlatState>(makeFlat(keys));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    const key = `k${i}`;
    reaction(
      () => state[key],
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const state = observable<FlatState>({ k0: 0 });
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    reaction(
      () => state.k0,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  const state = observable<NestedState>(makeNested());
  let wakes = 0;
  reaction(
    () => state.a.b.c.d.e.leaf,
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.a.b.c.d.e.leaf = j + 1;
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const state = observable<FlatState>(makeFlat(10));
  let wakes = 0;
  reaction(
    () => state.k0,
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

const deepMap = (items: number, updates: number): Sample => {
  const state = observable<DeepMapState>(makeItemMap(items));
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    const key = `i${i}`;
    reaction(
      () => state.items[key].meta.n,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.items[DEEP_MAP_TARGET].meta.n = j + 1;
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

const fanout = (keys: number, rounds: number): Sample => {
  const state = observable<FlatState>(makeFlat(keys));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    const key = `k${i}`;
    reaction(
      () => state[key],
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < keys; i++) {
      state[`k${i}`] = r + 1;
    }
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

// A real `computed` recomputes lazily and caches; the reaction wakes only when its value changes.
const derived = (values: number, updates: number): Sample => {
  const state = observable<SumState>(makeSumValues(values));
  const total = computed(() => sumValues(state.values));
  let wakes = 0;
  reaction(
    () => total.get(),
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.values[SUM_TARGET] = j + 1;
  }

  return { name: MOBX, wakes, ms: performance.now() - start };
};

export const mobxAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout, derived };
