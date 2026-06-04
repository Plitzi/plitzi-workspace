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

// Each store implements the same four workloads; the orchestrator runs each one repeatedly and aggregates.
export type StoreAdapter = {
  wide: (keys: number, updates: number) => Sample;
  hot: (subscribers: number, updates: number) => Sample;
  nested: (updates: number) => Sample;
  churn: (updates: number) => Sample;
};

export const SDK = '@plitzi/sdk-store';
export const ZUSTAND = 'Zustand';
export const JOTAI = 'Jotai';
export const NAIVE = 'Notify-all baseline';

export type FlatState = Record<string, number>;
export type NestedState = { a: { b: { c: { d: { e: { leaf: number } } } } } };

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
