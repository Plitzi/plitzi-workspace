import { atom, createStore } from 'jotai/vanilla';

import { JOTAI, makeNested, setLeaf, work } from './shared';

import type { Sample, StoreAdapter } from './shared';

// Jotai: one primitive atom per independent value; updating an atom only notifies its own subscribers.
const wide = (keys: number, updates: number): Sample => {
  const store = createStore();
  const atoms = Array.from({ length: keys }, () => atom(0));
  let wakes = 0;
  for (const cell of atoms) {
    store.sub(cell, () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.set(atoms[0], j + 1);
  }

  return { name: JOTAI, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const store = createStore();
  const cell = atom(0);
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    store.sub(cell, () => {
      wakes++;
      work(wakes);
    });
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.set(cell, j + 1);
  }

  return { name: JOTAI, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  const store = createStore();
  const cell = atom(makeNested());
  let wakes = 0;
  store.sub(cell, () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.set(cell, prev => setLeaf(prev, j + 1));
  }

  return { name: JOTAI, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const store = createStore();
  const cell = atom(0);
  let wakes = 0;
  store.sub(cell, () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.set(cell, j + 1);
  }

  return { name: JOTAI, wakes, ms: performance.now() - start };
};

export const jotaiAdapter: StoreAdapter = { wide, hot, nested, churn };
