import { makeFlat, makeNested, NAIVE, setLeaf, work } from './shared';

import type { Sample, NestedState, StoreAdapter } from './shared';

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

export const naiveAdapter: StoreAdapter = { wide, hot, nested, churn };
