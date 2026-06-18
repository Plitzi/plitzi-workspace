import {
  DEEP_MAP_TARGET,
  makeFlat,
  makeItemMap,
  makeNested,
  makeRowMap,
  makeSumValues,
  NAIVE,
  setLeaf,
  stridedIndices,
  sumValues,
  SUM_TARGET,
  work
} from './shared';

import type { DeepMapState, Row, Sample, NestedState, StoreAdapter } from './shared';

// Baseline (not a library): a store that notifies every subscriber on any change — what you get from React Context,
// or from any store subscribed to whole state instead of a path/selector.
const wide = (keys: number, updates: number): Sample => {
  const state = makeFlat(keys);
  const listeners: Array<() => void> = [];
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    listeners.push(() => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
    for (const listener of listeners) {
      listener();
    }
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const state = { k0: 0 };
  const listeners: Array<() => void> = [];
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    listeners.push(() => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
    for (const listener of listeners) {
      listener();
    }
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  let state: NestedState = makeNested();
  let wakes = 0;
  const listener = () => {
    wakes++;
    work(wakes);
  };

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state = setLeaf(state, j + 1);
    listener();
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const state = makeFlat(10);
  let wakes = 0;
  const listener = () => {
    wakes++;
    work(wakes);
  };

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.k0 = j + 1;
    listener();
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

// Baseline: notify every subscriber on any change, immutable map copy per write.
const deepMap = (items: number, updates: number): Sample => {
  let state: DeepMapState = makeItemMap(items);
  const listeners: Array<() => void> = [];
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    listeners.push(() => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    const prev = state.items[DEEP_MAP_TARGET];
    state = {
      items: { ...state.items, [DEEP_MAP_TARGET]: { ...prev, meta: { ...prev.meta, n: j + 1 } } }
    };
    for (const listener of listeners) {
      listener();
    }
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

const fanout = (keys: number, rounds: number): Sample => {
  const state = makeFlat(keys);
  const listeners: Array<() => void> = [];
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    listeners.push(() => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < keys; i++) {
      state[`k${i}`] = r + 1;
      for (const listener of listeners) {
        listener();
      }
    }
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

// Baseline: no memoization — recompute the derived on every change whether or not it mattered.
const derived = (values: number, updates: number): Sample => {
  const state = makeSumValues(values);
  let wakes = 0;
  const listener = () => {
    sumValues(state.values);
    wakes++;
    work(wakes);
  };

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    state.values[SUM_TARGET] = j + 1;
    listener();
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

// Baseline: copy the whole map per write and notify every subscriber, whatever changed.
const liveFeed = (items: number, updates: number): Sample => {
  let state: Record<string, Row> = makeRowMap(items);
  const listeners: Array<() => void> = [];
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    listeners.push(() => {
      wakes++;
      work(wakes);
    });
  }

  const plan = stridedIndices(items, updates);
  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    const key = `r${plan[j]}`;
    state = { ...state, [key]: { ...state[key], value: j + 1 } };
    for (const listener of listeners) {
      listener();
    }
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

// Baseline: a central selectedId; every subscriber wakes on every move.
const selection = (items: number, moves: number): Sample => {
  const state = { selectedId: 'r0' };
  const listeners: Array<() => void> = [];
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    listeners.push(() => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let m = 1; m <= moves; m++) {
    state.selectedId = `r${m % items}`;
    for (const listener of listeners) {
      listener();
    }
  }

  return { name: NAIVE, wakes, ms: performance.now() - start };
};

export const naiveAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout, derived, liveFeed, selection };
