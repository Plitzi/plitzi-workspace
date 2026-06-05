// A single timed run of one store on one scenario.
export type Sample = {
  name: string;
  wakes: number;
  ms: number;
};

// An aggregated result across repetitions: `ms` is the median (robust to GC/JIT jitter), `min` the best run.
export type LibResult = Sample & { min: number };

export type ScenarioResult = {
  id: string;
  label: string;
  description: string;
  results: LibResult[];
};

export type BenchmarkResult = {
  scenarios: ScenarioResult[];
};

// Worker protocol: the UI posts a request, the worker streams one message per finished scenario then `done`.
export type BenchmarkRequest = { reps: number };
export type BenchmarkWorkerMessage = { type: 'scenario'; scenario: ScenarioResult } | { type: 'done' };

// Each store implements the same workloads; the orchestrator runs each one repeatedly and aggregates.
export type StoreAdapter = {
  wide: (keys: number, updates: number) => Sample;
  hot: (subscribers: number, updates: number) => Sample;
  nested: (updates: number) => Sample;
  churn: (updates: number) => Sample;
  // Heavy / realistic: a normalized map of `items`, each watched, update one item's nested leaf `updates` times.
  deepMap: (items: number, updates: number) => Sample;
  // Heavy: `keys` values each with its own subscriber, update every key once per round for `rounds` rounds.
  fanout: (keys: number, rounds: number) => Sample;
  // A memoized derived value (sum over `values` inputs) with one subscriber; update one input `updates` times. Tests
  // each store's computed/selector machinery — the value recomputes per edit and wakes only when the result changes.
  derived: (values: number, updates: number) => Sample;
};

export const SDK = '@plitzi/sdk-store';
export const ZUSTAND = 'Zustand';
export const JOTAI = 'Jotai';
export const REDUX = 'Redux Toolkit';
export const MOBX = 'MobX';
export const VALTIO = 'Valtio';
export const NAIVE = 'Notify-all baseline';

export type FlatState = Record<string, number>;
export type NestedState = { a: { b: { c: { d: { e: { leaf: number } } } } } };

export type Item = { value: number; meta: { tag: string; n: number } };
export type DeepMapState = { items: Record<string, Item> };

// Stand-in for the work a woken subscriber actually does (a small component render). A trivial counter would
// understate the win — fine-grained subscriptions exist so uninterested subscribers never run this. Every store
// pays the same per-wake cost; only how many wakes (and how much copying) differs. The result feeds a shared sink
// so the loop can't be optimized away.
let sink = 0;

export const work = (seed: number): void => {
  let acc = seed;
  for (let i = 0; i < 30; i++) {
    acc += Math.sqrt(acc + i);
  }

  sink += acc;
};

export const resetSink = (): void => {
  sink = 0;
};

export const guardSink = (): void => {
  if (sink === Infinity) {
    throw new Error('unreachable');
  }
};

export const makeFlat = (keys: number): FlatState => {
  const state: FlatState = {};
  for (let i = 0; i < keys; i++) {
    state[`k${i}`] = 0;
  }

  return state;
};

export const makeNested = (): NestedState => ({ a: { b: { c: { d: { e: { leaf: 0 } } } } } });

export const setLeaf = (state: NestedState, value: number): NestedState => ({
  ...state,
  a: {
    ...state.a,
    b: { ...state.a.b, c: { ...state.a.b.c, d: { ...state.a.b.c.d, e: { ...state.a.b.c.d.e, leaf: value } } } }
  }
});

export const makeItemMap = (items: number): DeepMapState => {
  const map: Record<string, Item> = {};
  for (let i = 0; i < items; i++) {
    map[`i${i}`] = { value: 0, meta: { tag: 'el', n: 0 } };
  }

  return { items: map };
};

// The key whose nested leaf the deepMap workload updates (the rest are untouched siblings that must be preserved).
export const DEEP_MAP_TARGET = 'i0';

export type SumState = { values: Record<string, number> };

export const makeSumValues = (n: number): SumState => {
  const values: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    values[`k${i}`] = 0;
  }

  return { values };
};

export const sumValues = (values: Record<string, number>): number => {
  let sum = 0;
  for (const key in values) {
    sum += values[key];
  }

  return sum;
};

// The input the derived workload updates each iteration.
export const SUM_TARGET = 'k0';
