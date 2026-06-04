import { jotaiAdapter } from './jotaiStore';
import { mobxAdapter } from './mobxStore';
import { naiveAdapter } from './naiveStore';
import { reduxAdapter } from './reduxStore';
import { sdkAdapter } from './sdkStore';
import { guardSink, resetSink } from './shared';
import { valtioAdapter } from './valtioStore';
import { zustandAdapter } from './zustandStore';

import type { BenchmarkResult, LibResult, Sample, StoreAdapter } from './shared';

const ADAPTERS: StoreAdapter[] = [
  sdkAdapter,
  zustandAdapter,
  jotaiAdapter,
  reduxAdapter,
  mobxAdapter,
  valtioAdapter,
  naiveAdapter
];

type ScenarioConfig = {
  id: string;
  label: string;
  description: string;
  warmup: (adapter: StoreAdapter) => void;
  run: (adapter: StoreAdapter) => Sample;
};

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'wide',
    label: 'Wide state · 2,000 values, update 1',
    description: 'Atom stores touch only the changed cell; a single immutable tree must copy every sibling.',
    warmup: adapter => void adapter.wide(500, 50),
    run: adapter => adapter.wide(2000, 100)
  },
  {
    id: 'hot',
    label: 'Hot value · 1,000 subscribers, 60 updates',
    description: 'One value, many watchers — everyone must wake. A fair test of raw notification throughput.',
    warmup: adapter => void adapter.hot(200, 20),
    run: adapter => adapter.hot(1000, 60)
  },
  {
    id: 'nested',
    label: 'Nested state · 3,000 deep-leaf updates',
    description: 'A realistic shape: every store copies only the changed path, so all are competitive.',
    warmup: adapter => void adapter.nested(500),
    run: adapter => adapter.nested(3000)
  },
  {
    id: 'churn',
    label: 'Churn · 10,000 writes to one value',
    description: 'Raw per-update throughput: tiny store, a single subscriber, a flood of writes.',
    warmup: adapter => void adapter.churn(2000),
    run: adapter => adapter.churn(10000)
  },
  {
    id: 'deepMap',
    label: 'Normalized map · 2,000 items, update 1 nested leaf',
    description:
      'The real shape of app state (an entities map). Immutable stores copy the whole map per edit; atom and proxy stores touch only the item.',
    warmup: adapter => void adapter.deepMap(500, 20),
    run: adapter => adapter.deepMap(2000, 100)
  },
  {
    id: 'fanout',
    label: 'Fan-out · 100 keys × 20 rounds, one watcher each',
    description: 'A broad write burst: every key changes and wakes its own watcher. Tests write + dispatch volume.',
    warmup: adapter => void adapter.fanout(40, 5),
    run: adapter => adapter.fanout(100, 20)
  }
];

// Repeats a measurement and reports the median (robust to GC/JIT spikes) plus the best run. A single timed pass is
// what makes benchmark numbers swing between clicks — repeating and taking the median makes them reproducible.
const measure = (run: () => Sample, reps: number): LibResult => {
  const samples: number[] = [];
  let last: Sample | undefined;
  for (let r = 0; r < reps; r++) {
    last = run();
    samples.push(last.ms);
  }

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];

  return { name: last?.name ?? '', wakes: last?.wakes ?? 0, ms: median, min: samples[0] };
};

// Runs every scenario against all four stores. Each store is warmed first so JIT compilation doesn't skew the timed
// passes, then measured `reps` times.
export function runBenchmark(reps = 5): BenchmarkResult {
  resetSink();

  for (const scenario of SCENARIOS) {
    for (const adapter of ADAPTERS) {
      scenario.warmup(adapter);
    }
  }

  const scenarios = SCENARIOS.map(scenario => ({
    id: scenario.id,
    label: scenario.label,
    description: scenario.description,
    results: ADAPTERS.map(adapter => measure(() => scenario.run(adapter), reps))
  }));

  guardSink();

  return { scenarios };
}
